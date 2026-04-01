import os
import re
import fitz  # PyMuPDF
from .module_registry import ExtractedItem

# Render resolution
_DPI = 200
_MAT = fitz.Matrix(_DPI / 72, _DPI / 72)

MIN_IMAGE_PX = 80           # px  — skip renders smaller than this
MIN_FIGURE_HEIGHT_PTS = 40  # pts — skip crop regions shallower than this
SIGNIFICANT_GAP_PTS = 20    # pts — vertical whitespace gap that signals "figure space"
COL_MARGIN_PTS = 15         # pts — extra horizontal margin when clipping a single column

# Content validation thresholds
# Drawing paths: count paths intersecting the crop; >= this many → real figure.
# Counting paths is more reliable than area for scatter plots, line charts etc.
# where each element is a tiny path.
MIN_DRAWING_COUNT = 5
MAX_TEXT_COVERAGE = 0.70       # if text blocks cover > 70 % of crop → discard as body text

# Caption anchor pattern (re.match anchors to block start):
#   • Matches "Figure N" / "Fig. N" / "Fig N" at the START of the block text
#   • No trailing delimiter required — handles blocks whose text is exactly
#     "Figure 1" with no following characters
_CAPTION_RE = re.compile(
    r'\s*(?:Figure|Fig\.?)\s*\d+(?:\.\d+)?',
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _classify_column(cx0: float, cx1: float, page_w: float) -> str:
    """Classify caption as 'left', 'right', or 'full' based on its x-span."""
    if (cx1 - cx0) / page_w > 0.55:
        return "full"
    return "left" if (cx0 + cx1) / 2 < page_w / 2 else "right"


def _has_figure_content(
    clip_rect: fitz.Rect,
    page_drawings: list,
    all_blocks: list,
    col_text_blocks: list,
) -> bool:
    """
    Return True if the clip region is likely a real figure (not plain body text).

    Three-stage check (in descending confidence):
    1. Vector drawing count — count distinct drawing paths that intersect the
       crop region.  Academic charts/diagrams have many paths (lines, markers,
       boxes, arrows); plain text areas have 0–2 (at most a column border).
       Threshold: MIN_DRAWING_COUNT paths.
    2. Raster image blocks (block_type == 1) overlapping the region.
    3. Text-coverage ratio — same-column text blocks cover <= MAX_TEXT_COVERAGE
       of the crop area.  70 % is intentionally lenient: architecture diagrams
       with many component labels can have high text density while still being
       real figures.
    """
    # 1. Count vector drawing paths that intersect the clip region
    draw_count = 0
    for d in page_drawings:
        try:
            dr = fitz.Rect(d["rect"])
        except (KeyError, TypeError, ValueError):
            continue
        if dr.is_empty or dr.is_infinite:
            continue
        if not (clip_rect & dr).is_empty:
            draw_count += 1
            if draw_count >= MIN_DRAWING_COUNT:
                return True

    # 2. Raster image blocks (block_type == 1)
    for b in all_blocks:
        if len(b) >= 7 and b[6] == 1:
            if not (clip_rect & fitz.Rect(b[0], b[1], b[2], b[3])).is_empty:
                return True

    # 3. Text-coverage fallback
    clip_area = clip_rect.width * clip_rect.height
    if clip_area <= 0:
        return False

    text_area = 0.0
    for b in col_text_blocks:
        inter = clip_rect & fitz.Rect(b[0], b[1], b[2], b[3])
        if not inter.is_empty:
            text_area += inter.width * inter.height

    return (text_area / clip_area) <= MAX_TEXT_COVERAGE


# ---------------------------------------------------------------------------
# Main extractor
# ---------------------------------------------------------------------------

def extract_images_from_pdf(pdf_path: str, output_dir: str, paper_id: str) -> list[ExtractedItem]:
    """
    Extract figures from a PDF by rendering the area above each 'Figure N' caption.

    Algorithm overview
    ──────────────────
    For each page:

    1. Collect text-only blocks (block_type == 0).  Image blocks (type == 1) are
       tracked separately for content validation but not used for boundary detection.

    2. Find caption blocks using _CAPTION_RE with re.match — the pattern must
       appear at the *start* of the block's text.  This avoids false positives like
       "as shown in Figure 1" appearing in body paragraphs.

    3. For each caption (sorted top-to-bottom):
       a. Detect the caption's column (left / right / full-width).
       b. Filter non-caption text blocks to the same column and vertical zone.
       c. Walk upward from the caption; stop at the first vertical gap
          >= SIGNIFICANT_GAP_PTS — that gap is the figure area.
       d. Validate the crop with _has_figure_content() (vector paths, raster
          images, or low text-coverage ratio).  Discard text-only crops.
       e. Render and save.
    """
    os.makedirs(output_dir, exist_ok=True)
    items: list[ExtractedItem] = []

    doc = fitz.open(pdf_path)
    try:
        for page_index in range(len(doc)):
            page = doc[page_index]
            page_num = page_index + 1
            page_w = page.rect.width

            # Collect all blocks once — split into text and "other" (images)
            all_blocks = page.get_text("blocks")
            text_blocks = [
                b for b in all_blocks
                if len(b) >= 7 and b[6] == 0 and isinstance(b[4], str)
            ]

            # Collect vector drawings once per page (reused for every caption)
            try:
                page_drawings = page.get_drawings()
            except Exception:
                page_drawings = []

            # Caption detection — anchored to block start
            caption_blocks = [
                b for b in text_blocks
                if _CAPTION_RE.match(b[4])
            ]
            if not caption_blocks:
                continue

            caption_id_set = set(map(id, caption_blocks))
            non_caption = [b for b in text_blocks if id(b) not in caption_id_set]
            caption_blocks.sort(key=lambda b: b[1])  # top-to-bottom

            prev_y = 0.0

            for cap_block in caption_blocks:
                cx0, cy0, cx1, cy1, cap_text = cap_block[:5]

                col = _classify_column(cx0, cx1, page_w)
                page_mid = page_w / 2

                # ── Same-column text blocks in our vertical search zone ──────
                if col == "full":
                    zone_blocks = [b for b in non_caption if prev_y <= b[3] <= cy0]
                    col_text = text_blocks                          # all columns for coverage check
                elif col == "left":
                    zone_blocks = [
                        b for b in non_caption
                        if prev_y <= b[3] <= cy0 and (b[0] + b[2]) / 2 < page_mid
                    ]
                    col_text = [b for b in text_blocks if (b[0] + b[2]) / 2 < page_mid]
                else:  # right
                    zone_blocks = [
                        b for b in non_caption
                        if prev_y <= b[3] <= cy0 and (b[0] + b[2]) / 2 >= page_mid
                    ]
                    col_text = [b for b in text_blocks if (b[0] + b[2]) / 2 >= page_mid]

                # Sort: closest to caption first (highest y1 = bottom edge)
                zone_blocks.sort(key=lambda b: b[3], reverse=True)

                # ── Upward gap walk ──────────────────────────────────────────
                # Walk block-by-block from the caption toward the top of the zone.
                # The first vertical gap >= SIGNIFICANT_GAP_PTS is the figure space.
                current_pos = cy0
                fig_y0 = prev_y    # fallback: entire zone is whitespace
                fig_y1 = cy0 - 2  # fallback: just above caption

                for block in zone_blocks:
                    gap = current_pos - block[3]        # space below this block to our cursor
                    if gap >= SIGNIFICANT_GAP_PTS:
                        fig_y0 = block[3]               # figure starts at this block's bottom
                        fig_y1 = current_pos - 2        # figure ends just above where we were
                        break
                    current_pos = block[1]              # step above this block, continue walking

                if fig_y1 - fig_y0 < MIN_FIGURE_HEIGHT_PTS:
                    prev_y = cy1
                    continue

                # ── Horizontal clip ──────────────────────────────────────────
                if col == "left":
                    clip_x0, clip_x1 = 0.0, page_mid + COL_MARGIN_PTS
                elif col == "right":
                    clip_x0, clip_x1 = max(0.0, page_mid - COL_MARGIN_PTS), page_w
                else:
                    clip_x0, clip_x1 = 0.0, page_w

                clip_rect = fitz.Rect(clip_x0, fig_y0, clip_x1, fig_y1)

                # ── Content validation — discard text-only crops ─────────────
                if not _has_figure_content(clip_rect, page_drawings, all_blocks, col_text):
                    prev_y = cy1
                    continue

                # ── Render and save ──────────────────────────────────────────
                pix = page.get_pixmap(matrix=_MAT, clip=clip_rect)

                if pix.width < MIN_IMAGE_PX or pix.height < MIN_IMAGE_PX:
                    prev_y = cy1
                    continue

                filename = f"p{page_num}_{len(items)}.png"
                pix.save(os.path.join(output_dir, filename))

                items.append(ExtractedItem(
                    image_path=f"{paper_id}/{filename}",
                    page_number=page_num,
                    caption=" ".join(cap_text.split())[:500],
                ))
                prev_y = cy1

    finally:
        doc.close()

    return items

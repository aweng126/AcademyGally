# Metadata Auto-Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual metadata entry with a two-step upload flow: upload PDF → auto-extract metadata via VLM + Semantic Scholar → user confirms on a dedicated page.

**Architecture:** PDF upload creates a Paper with `status=awaiting_metadata` and triggers a background task that renders page 1 as an image, sends it to the configured VLM (GLM/Claude), then queries Semantic Scholar for cross-verification. The frontend polls a new endpoint until extraction completes, pre-fills the confirmation form with VLM results, and shows Scholar suggestions inline.

**Tech Stack:** PyMuPDF (fitz), existing vlm_analyzer service, Semantic Scholar REST API (no key needed), urllib.request (stdlib), SQLAlchemy batch migrations, Next.js App Router

---

### Task 1: Database Migration — Add Metadata Columns & Enum Value

**Files:**
- Create: `backend/migrations/versions/a1b2c3d4e5f6_add_metadata_fields.py`
- Modify: `backend/models/paper.py`

- [ ] **Step 1: Create the migration file**

```python
# backend/migrations/versions/a1b2c3d4e5f6_add_metadata_fields.py
"""add_metadata_fields

Revision ID: a1b2c3d4e5f6
Revises: 2e7e6c0002d3
Create Date: 2026-03-31

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '2e7e6c0002d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("papers") as batch_op:
        batch_op.add_column(sa.Column("institution", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("raw_extracted_metadata", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("scholar_metadata", sa.Text(), nullable=True))
        batch_op.alter_column(
            "processing_status",
            type_=sa.Enum(
                "awaiting_metadata", "pending", "processing", "done", "failed",
                name="paper_status"
            ),
            existing_type=sa.Enum(
                "pending", "processing", "done", "failed",
                name="paper_status"
            ),
        )


def downgrade() -> None:
    with op.batch_alter_table("papers") as batch_op:
        batch_op.drop_column("institution")
        batch_op.drop_column("raw_extracted_metadata")
        batch_op.drop_column("scholar_metadata")
        batch_op.alter_column(
            "processing_status",
            type_=sa.Enum(
                "pending", "processing", "done", "failed",
                name="paper_status"
            ),
            existing_type=sa.Enum(
                "awaiting_metadata", "pending", "processing", "done", "failed",
                name="paper_status"
            ),
        )
```

- [ ] **Step 2: Update the Paper ORM model**

Replace `backend/models/paper.py` with:

```python
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Enum as SAEnum, Text
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class Paper(Base):
    __tablename__ = "papers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String, nullable=False, default="")
    venue: Mapped[str] = mapped_column(String, nullable=True)
    year: Mapped[int] = mapped_column(nullable=True)
    authors: Mapped[str] = mapped_column(String, nullable=True)
    doi: Mapped[str] = mapped_column(String, nullable=True)
    institution: Mapped[str] = mapped_column(String, nullable=True)
    pdf_path: Mapped[str] = mapped_column(String, nullable=False)
    processing_status: Mapped[str] = mapped_column(
        SAEnum("awaiting_metadata", "pending", "processing", "done", "failed", name="paper_status"),
        default="awaiting_metadata",
    )
    raw_extracted_metadata: Mapped[str] = mapped_column(Text, nullable=True)
    scholar_metadata: Mapped[str] = mapped_column(Text, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

- [ ] **Step 3: Run migration to verify it works**

```bash
cd backend && alembic upgrade head
```

Expected: `Running upgrade 2e7e6c0002d3 -> a1b2c3d4e5f6, add_metadata_fields`

- [ ] **Step 4: Commit**

```bash
git add backend/migrations/versions/a1b2c3d4e5f6_add_metadata_fields.py backend/models/paper.py
git commit -m "feat: add metadata extraction columns and awaiting_metadata status"
```

---

### Task 2: New Prompt File for Metadata Extraction

**Files:**
- Create: `backend/prompts/metadata.txt`

- [ ] **Step 1: Create the prompt**

```
You are analyzing the first page of an academic paper.
Extract the paper's metadata and return ONLY valid JSON matching the schema below. No markdown, no preamble, no explanation.

Schema:
{
  "title": "full paper title as written",
  "authors": ["Author Name 1", "Author Name 2"],
  "year": 2024,
  "venue": "conference or journal name, e.g. OSDI, NeurIPS, SOSP",
  "institution": "primary institution or affiliation"
}

Rules:
- title: exact title from the paper, preserve capitalization
- authors: list of full author names as they appear on the page
- year: integer year of publication if visible, otherwise null
- venue: short canonical name if visible (e.g. "OSDI '23" becomes "OSDI"), otherwise null
- institution: primary institution or affiliation of first author, otherwise null
- If a field is not visible on this page, use null
```

- [ ] **Step 2: Commit**

```bash
git add backend/prompts/metadata.txt
git commit -m "feat: add VLM prompt for paper metadata extraction"
```

---

### Task 3: New Service — `metadata_extractor.py`

**Files:**
- Create: `backend/services/metadata_extractor.py`

- [ ] **Step 1: Create the service**

```python
# backend/services/metadata_extractor.py
"""
Metadata extraction service.

1. Renders PDF page 0 to PNG.
2. Sends to configured VLM (via vlm_analyzer) to extract title/authors/year/venue/institution.
3. Queries Semantic Scholar API with the extracted title for cross-verification.
"""
import json
import logging
import os
import urllib.parse
import urllib.request
from pathlib import Path

import fitz  # PyMuPDF

from services.vlm_analyzer import analyze_image

logger = logging.getLogger(__name__)

FIGURES_DIR = Path(os.getenv("FIGURES_DIR", "./data/figures"))


def extract_metadata(paper_id: str, pdf_path: str) -> dict:
    """
    Returns:
        {
            "vlm_result": {title, authors, year, venue, institution} | None,
            "scholar_suggestion": {title, authors, year, venue, doi} | None,
        }
    """
    vlm_result = _extract_via_vlm(paper_id, pdf_path)
    scholar_suggestion = None
    if vlm_result and vlm_result.get("title"):
        scholar_suggestion = _query_semantic_scholar(vlm_result["title"])
    return {"vlm_result": vlm_result, "scholar_suggestion": scholar_suggestion}


def _extract_via_vlm(paper_id: str, pdf_path: str) -> dict | None:
    """Render PDF page 0 as PNG, send to VLM, return structured metadata dict."""
    page_img_dir = FIGURES_DIR / paper_id
    page_img_dir.mkdir(parents=True, exist_ok=True)
    page_img_path = page_img_dir / "page_0_meta.png"
    rel_path = f"{paper_id}/page_0_meta.png"

    doc = fitz.open(pdf_path)
    try:
        page = doc[0]
        pix = page.get_pixmap(dpi=150)
        pix.save(str(page_img_path))
    finally:
        doc.close()

    try:
        return analyze_image(rel_path, "metadata")
    except Exception as e:
        logger.warning("VLM metadata extraction failed: %s", e, exc_info=True)
        return None


def _query_semantic_scholar(title: str) -> dict | None:
    """Query Semantic Scholar for paper metadata by title. Returns None on any error."""
    try:
        query = urllib.parse.quote(title)
        url = (
            "https://api.semanticscholar.org/graph/v1/paper/search"
            f"?query={query}&fields=title,authors,year,venue,externalIds&limit=1"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "AcademyGally/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())

        papers = data.get("data", [])
        if not papers:
            return None

        p = papers[0]
        return {
            "title": p.get("title"),
            "authors": [a["name"] for a in p.get("authors", [])],
            "year": p.get("year"),
            "venue": p.get("venue"),
            "doi": (p.get("externalIds") or {}).get("DOI"),
        }
    except Exception as e:
        logger.warning("Semantic Scholar query failed: %s", e, exc_info=True)
        return None
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/metadata_extractor.py
git commit -m "feat: add metadata_extractor service (VLM + Semantic Scholar)"
```

---

### Task 4: Update Schemas

**Files:**
- Modify: `backend/schemas.py`

- [ ] **Step 1: Add new schema classes to `backend/schemas.py`**

Add these classes (after the existing imports and before or after existing classes):

```python
# — Metadata extraction schemas —————————————————————————————

class VlmMetadataResult(BaseModel):
    title: str | None = None
    authors: list[str] | None = None
    year: int | None = None
    venue: str | None = None
    institution: str | None = None


class ScholarSuggestion(BaseModel):
    title: str | None = None
    authors: list[str] | None = None
    year: int | None = None
    venue: str | None = None
    doi: str | None = None


class PaperMetadataResponse(BaseModel):
    id: str
    status: str          # "extracting" | "ready" | "failed"
    vlm_result: VlmMetadataResult | None = None
    scholar_suggestion: ScholarSuggestion | None = None


class MetadataConfirm(BaseModel):
    title: str
    authors: str | None = None
    year: int | None = None
    venue: str | None = None
    institution: str | None = None
    doi: str | None = None
```

- [ ] **Step 2: Update `PaperOut` to include `institution` field**

Find the `PaperOut` class and add `institution`:

```python
class PaperOut(BaseModel):
    id: str
    title: str
    venue: str | None = None
    year: int | None = None
    authors: str | None = None
    doi: str | None = None
    institution: str | None = None
    pdf_path: str
    processing_status: str
    uploaded_at: datetime
    content_items: list[ContentItemOut] = []

    model_config = ConfigDict(from_attributes=True)
```

- [ ] **Step 3: Commit**

```bash
git add backend/schemas.py
git commit -m "feat: add metadata extraction schemas"
```

---

### Task 5: Update Papers Router

**Files:**
- Modify: `backend/routers/papers.py`

- [ ] **Step 1: Add imports at top of `backend/routers/papers.py`**

Add these to the existing imports:

```python
from services.metadata_extractor import extract_metadata
from schemas import (
    PaperOut, ConfirmItemsRequest, ConfirmItemEntry,
    PaperMetadataResponse, VlmMetadataResult, ScholarSuggestion, MetadataConfirm,
)
```

- [ ] **Step 2: Add background task function for metadata extraction**

Add this function before `_process_paper_bg`:

```python
def _extract_metadata_bg(paper_id: str, pdf_path: str) -> None:
    """Background task: extract metadata via VLM + Scholar, store in paper record."""
    db = SessionLocal()
    try:
        paper = db.get(Paper, paper_id)
        if not paper:
            return
        result = extract_metadata(paper_id, pdf_path)
        paper.raw_extracted_metadata = json.dumps(result.get("vlm_result") or {})
        paper.scholar_metadata = json.dumps(result.get("scholar_suggestion") or {})
        db.commit()
    except Exception as e:
        logger.warning("Metadata extraction BG task failed for %s: %s", paper_id, e, exc_info=True)
        db = SessionLocal()
        paper = db.get(Paper, paper_id)
        if paper:
            paper.raw_extracted_metadata = json.dumps({})
            db.commit()
    finally:
        db.close()
```

Make sure `import json` is at the top of the file.

- [ ] **Step 3: Update `POST /papers` endpoint (upload_paper)**

Replace the existing `upload_paper` function signature and body:

```python
@router.post("", response_model=PaperOut)
async def upload_paper(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(default=""),
    venue: str = Form(default=""),
    year: int = Form(default=None),
    authors: str = Form(default=""),
    db: Session = Depends(get_db),
):
    pdfs_dir = os.getenv("PDFS_DIR", "./data/pdfs")
    os.makedirs(pdfs_dir, exist_ok=True)
    paper_id = str(uuid.uuid4())
    pdf_filename = f"{paper_id}.pdf"
    pdf_path = os.path.join(pdfs_dir, pdf_filename)

    with open(pdf_path, "wb") as f:
        content = await file.read()
        f.write(content)

    paper = Paper(
        id=paper_id,
        title=title or "",
        venue=venue or None,
        year=year,
        authors=authors or None,
        pdf_path=pdf_path,
        processing_status="awaiting_metadata",
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)

    background_tasks.add_task(_extract_metadata_bg, paper.id, pdf_path)
    return paper
```

- [ ] **Step 4: Add `GET /papers/{paper_id}/metadata` endpoint**

Add after the existing `get_paper` endpoint:

```python
@router.get("/{paper_id}/metadata", response_model=PaperMetadataResponse)
def get_paper_metadata(paper_id: str, db: Session = Depends(get_db)):
    paper = db.get(Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    # raw_extracted_metadata is None → still extracting
    if paper.raw_extracted_metadata is None:
        return PaperMetadataResponse(id=paper_id, status="extracting")

    vlm_data = json.loads(paper.raw_extracted_metadata) if paper.raw_extracted_metadata else {}
    scholar_data = json.loads(paper.scholar_metadata) if paper.scholar_metadata else {}

    return PaperMetadataResponse(
        id=paper_id,
        status="ready",
        vlm_result=VlmMetadataResult(**vlm_data) if vlm_data else None,
        scholar_suggestion=ScholarSuggestion(**scholar_data) if scholar_data else None,
    )
```

- [ ] **Step 5: Add `POST /papers/{paper_id}/metadata` endpoint**

```python
@router.post("/{paper_id}/metadata", response_model=PaperOut)
def confirm_paper_metadata(
    paper_id: str,
    body: MetadataConfirm,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    paper = db.get(Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    paper.title = body.title
    paper.authors = body.authors
    paper.year = body.year
    paper.venue = body.venue
    paper.institution = body.institution
    paper.doi = body.doi
    paper.processing_status = "pending"
    db.commit()
    db.refresh(paper)

    background_tasks.add_task(_process_paper_bg, paper.id, paper.pdf_path)
    return paper
```

- [ ] **Step 6: Add `DELETE /papers/{paper_id}` endpoint**

```python
@router.delete("/{paper_id}", status_code=204)
def delete_paper(paper_id: str, db: Session = Depends(get_db)):
    paper = db.get(Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    db.delete(paper)
    db.commit()
```

- [ ] **Step 7: Commit**

```bash
git add backend/routers/papers.py
git commit -m "feat: update upload to two-step flow, add metadata endpoints"
```

---

### Task 6: Update Frontend Types

**Files:**
- Modify: `frontend/lib/types.ts`

- [ ] **Step 1: Update `types.ts`**

Add `awaiting_metadata` to `ProcessingStatus`, add `institution` to `Paper`, and add the new metadata interfaces:

```typescript
export type ProcessingStatus = "awaiting_metadata" | "pending" | "processing" | "done" | "failed";
export type ModuleType = "arch_figure" | "abstract" | "eval_figure" | "algorithm" | "other";

export interface Paper {
  id: string;
  title: string;
  venue?: string;
  year?: number;
  authors?: string;
  doi?: string;
  institution?: string;
  pdf_path: string;
  processing_status: ProcessingStatus;
  uploaded_at: string;
  content_items?: ContentItem[];
}

export interface VlmMetadataResult {
  title?: string;
  authors?: string[];
  year?: number;
  venue?: string;
  institution?: string;
}

export interface ScholarSuggestion {
  title?: string;
  authors?: string[];
  year?: number;
  venue?: string;
  doi?: string;
}

export interface PaperMetadataResponse {
  id: string;
  status: "extracting" | "ready" | "failed";
  vlm_result?: VlmMetadataResult;
  scholar_suggestion?: ScholarSuggestion;
}
```

(Keep all existing interfaces below — ContentItem, Topic, etc. unchanged.)

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/types.ts
git commit -m "feat: add metadata types, institution field, awaiting_metadata status"
```

---

### Task 7: Update Frontend API Client

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Add three new functions to `api.ts`**

Add after `uploadPaper`:

```typescript
export async function getPaperMetadata(id: string): Promise<PaperMetadataResponse> {
  return request<PaperMetadataResponse>(`/papers/${id}/metadata`);
}

export async function confirmPaperMetadata(
  id: string,
  data: {
    title: string;
    authors?: string;
    year?: number;
    venue?: string;
    institution?: string;
    doi?: string;
  }
): Promise<Paper> {
  return request<Paper>(`/papers/${id}/metadata`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deletePaper(id: string): Promise<void> {
  await request<void>(`/papers/${id}`, { method: "DELETE" });
}
```

Make sure `PaperMetadataResponse` is imported from `./types`.

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat: add getPaperMetadata, confirmPaperMetadata, deletePaper API functions"
```

---

### Task 8: Simplify LibraryView Upload Form

**Files:**
- Modify: `frontend/components/library/LibraryView.tsx`

- [ ] **Step 1: Replace the upload section**

Find the `handleUpload` function and the form JSX. Replace them so the form only takes a file, and redirects to the metadata page on success:

```typescript
// Add at top of file:
import { useRouter } from "next/navigation";

// Inside LibraryView component, add:
const router = useRouter();

// Replace handleUpload:
async function handleUpload(e: React.FormEvent) {
  e.preventDefault();
  if (!uploadFile) return;
  setUploading(true);
  try {
    const form = new FormData();
    form.append("file", uploadFile);
    const paper = await uploadPaper(form);
    router.push(`/papers/${paper.id}/metadata`);
  } catch (err) {
    console.error(err);
    setUploading(false);
  }
}
```

Replace the upload form JSX with the minimal version:

```tsx
{showUpload && (
  <form onSubmit={handleUpload} className="mb-6 flex items-center gap-3 rounded-lg border border-dashed border-gray-300 p-4">
    <input
      type="file"
      accept=".pdf"
      required
      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
      className="flex-1 text-sm text-gray-600"
    />
    <button
      type="submit"
      disabled={uploading || !uploadFile}
      className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
    >
      {uploading ? "Uploading…" : "Upload"}
    </button>
    <button type="button" onClick={() => setShowUpload(false)} className="text-sm text-gray-400 hover:text-gray-600">
      Cancel
    </button>
  </form>
)}
```

Remove the state variables that are no longer needed: `uploadTitle`, `uploadVenue`, `uploadYear`, `uploadAuthors`. Keep: `uploadFile`, `uploading`, `showUpload`.

- [ ] **Step 2: Commit**

```bash
git add frontend/components/library/LibraryView.tsx
git commit -m "feat: simplify upload form to PDF-only, redirect to metadata confirmation"
```

---

### Task 9: New Metadata Confirmation Page

**Files:**
- Create: `frontend/app/papers/[id]/metadata/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getPaperMetadata, confirmPaperMetadata, deletePaper } from "@/lib/api";
import type { VlmMetadataResult, ScholarSuggestion } from "@/lib/types";

interface Props {
  params: { id: string };
}

export default function MetadataPage({ params }: Props) {
  const router = useRouter();
  const { id } = params;

  const [status, setStatus] = useState<"extracting" | "ready" | "failed">("extracting");
  const [vlm, setVlm] = useState<VlmMetadataResult | null>(null);
  const [scholar, setScholar] = useState<ScholarSuggestion | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [year, setYear] = useState("");
  const [venue, setVenue] = useState("");
  const [institution, setInstitution] = useState("");
  const [doi, setDoi] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-fill form once VLM result arrives
  function applyVlm(v: VlmMetadataResult) {
    setTitle(v.title ?? "");
    setAuthors(v.authors?.join(", ") ?? "");
    setYear(v.year?.toString() ?? "");
    setVenue(v.venue ?? "");
    setInstitution(v.institution ?? "");
  }

  useEffect(() => {
    let elapsed = 0;
    pollRef.current = setInterval(async () => {
      elapsed += 2;
      try {
        const data = await getPaperMetadata(id);
        if (data.status !== "extracting") {
          clearInterval(pollRef.current!);
          setStatus(data.status);
          if (data.vlm_result) {
            setVlm(data.vlm_result);
            applyVlm(data.vlm_result);
          }
          if (data.scholar_suggestion) setScholar(data.scholar_suggestion);
        } else if (elapsed >= 30) {
          clearInterval(pollRef.current!);
          setStatus("ready"); // show empty form after timeout
        }
      } catch {
        clearInterval(pollRef.current!);
        setStatus("ready");
      }
    }, 2000);
    return () => clearInterval(pollRef.current!);
  }, [id]);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await confirmPaperMetadata(id, {
        title,
        authors: authors || undefined,
        year: year ? parseInt(year, 10) : undefined,
        venue: venue || undefined,
        institution: institution || undefined,
        doi: doi || undefined,
      });
      router.push(`/papers/${id}/confirm`);
    } catch {
      setSubmitError("Failed to save metadata. Please try again.");
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    try {
      await deletePaper(id);
    } finally {
      router.push("/");
    }
  }

  // Suggest button: copies Scholar value into field
  function SuggestButton({ value, onAdopt }: { value?: string; current: string; onAdopt: () => void }) {
    if (!value) return null;
    return (
      <button
        type="button"
        onClick={onAdopt}
        className="ml-2 text-xs text-blue-500 hover:text-blue-700"
      >
        💡 Scholar: &ldquo;{value}&rdquo; [adopt]
      </button>
    );
  }

  if (status === "extracting") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto" />
          <p className="text-gray-600">Extracting metadata from your PDF…</p>
          <p className="text-sm text-gray-400 mt-1">This usually takes 5–15 seconds</p>
        </div>
      </div>
    );
  }

  const scholarAuthorsStr = scholar?.authors?.join(", ");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Review Paper Metadata</h1>
      <p className="mb-6 text-sm text-gray-500">
        Extracted automatically. Review and confirm before processing.
      </p>

      <form onSubmit={handleConfirm} className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {scholar?.title && scholar.title !== title && (
            <SuggestButton value={scholar.title} current={title} onAdopt={() => setTitle(scholar.title!)} />
          )}
        </div>

        {/* Authors */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Authors</label>
          <input
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
            placeholder="Comma-separated names"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {scholarAuthorsStr && scholarAuthorsStr !== authors && (
            <SuggestButton value={scholarAuthorsStr} current={authors} onAdopt={() => setAuthors(scholarAuthorsStr)} />
          )}
        </div>

        {/* Year + Venue */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2024"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {scholar?.year && scholar.year.toString() !== year && (
              <SuggestButton value={scholar.year.toString()} current={year} onAdopt={() => setYear(scholar.year!.toString())} />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="OSDI, NeurIPS…"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {scholar?.venue && scholar.venue !== venue && (
              <SuggestButton value={scholar.venue} current={venue} onAdopt={() => setVenue(scholar.venue!)} />
            )}
          </div>
        </div>

        {/* Institution */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
          <input
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="Google Brain, MIT CSAIL…"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* DOI (from Scholar only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            DOI
            {scholar?.doi && <span className="ml-2 text-xs text-blue-500">from Semantic Scholar</span>}
          </label>
          <input
            value={doi}
            onChange={(e) => setDoi(e.target.value)}
            placeholder="10.1145/…"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {submitError && (
          <p className="text-sm text-red-600">{submitError}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Confirm & Process →"}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/papers/[id]/metadata/page.tsx
git commit -m "feat: add metadata confirmation page with Scholar suggestions"
```

---

### Task 10: Final Integration Check & Push

- [ ] **Step 1: Verify backend starts without errors**

```bash
cd backend && python -c "from services.metadata_extractor import extract_metadata; print('OK')"
```

Expected: `OK`

- [ ] **Step 2: Verify frontend builds without type errors**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no output (no errors)

- [ ] **Step 3: Rebuild Docker and smoke-test**

```bash
docker compose down && docker compose up --build -d
# Wait ~20s for backend to be healthy, then:
curl http://localhost:8000/health
# Expected: {"status":"ok"} or similar
```

- [ ] **Step 4: End-to-end smoke test**

1. Open http://localhost:3000
2. Click "+ Upload Paper", select a PDF, click Upload
3. Should redirect to `/papers/{id}/metadata` with spinner
4. After 5–15s, form should pre-fill with extracted data
5. Scholar suggestion buttons should appear if data differs
6. Click "Confirm & Process" → redirects to confirm page

- [ ] **Step 5: Final commit and push**

```bash
git push origin main
```

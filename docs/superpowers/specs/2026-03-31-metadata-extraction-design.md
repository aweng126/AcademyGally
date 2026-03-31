# Metadata Auto-Extraction Design

**Date:** 2026-03-31  
**Status:** Approved

## Overview

Replace manual metadata entry (title, authors, year, venue, institution) with a two-step upload flow:
1. User uploads PDF only — system auto-extracts metadata via VLM + Semantic Scholar
2. User reviews and confirms pre-filled metadata before processing begins

## User Flow

```
Step 1: Upload
  User selects PDF file → POST /papers (PDF only, title optional)
  → Backend saves PDF, renders page 1 as image
  → Async: VLM extracts structured metadata from page 1 image
  → Async: Semantic Scholar search supplements/validates
  → Frontend redirects to /papers/{id}/metadata

Step 2: Metadata Confirmation (/papers/{id}/metadata)
  Frontend polls GET /papers/{id}/metadata until status != "extracting"
  → Form pre-filled with VLM-extracted values
  → Scholar suggestions shown inline per field with [adopt] button
  → User reviews, edits, confirms → POST /papers/{id}/metadata
  → Redirects to existing /papers/{id}/confirm (image module confirmation)

Step 3: Existing pipeline (unchanged)
  Image extraction → module confirmation → VLM analysis
```

## Backend

### Database Changes

Two new nullable JSON columns on the `papers` table:
- `raw_extracted_metadata` (TEXT) — VLM extraction result
- `scholar_metadata` (TEXT) — Semantic Scholar API response

New `processing_status` value: `awaiting_metadata`  
Full status sequence: `awaiting_metadata` → `pending` → `processing` → `done` | `failed`

### New Service: `backend/services/metadata_extractor.py`

**Responsibilities:**
1. Render PDF page 1 to PNG using PyMuPDF (`page.get_pixmap()`)
2. Call existing `vlm_analyzer.analyze_image()` with new prompt `prompts/metadata.txt`
3. Call Semantic Scholar API with extracted title
4. Return `{vlm_result, scholar_suggestion}`

**VLM output schema** (`prompts/metadata.txt`):
```json
{
  "title": "string",
  "authors": ["string"],
  "year": 2024,
  "venue": "string",
  "institution": "string"
}
```

**Semantic Scholar API call:**
```
GET https://api.semanticscholar.org/graph/v1/paper/search
  ?query=<url-encoded title>
  &fields=title,authors,year,venue,externalIds
  &limit=1
```
No API key required. Returns top match. Extract: `title`, `authors[].name`, `year`, `venue`, `externalIds.DOI`.

**Fallback behavior:**
- If VLM extraction fails: all fields empty, user must fill manually
- If Semantic Scholar fails or returns no match: scholar_suggestion is null, no suggestions shown
- Network errors are caught and logged; never block the confirmation page

### API Changes

| Endpoint | Change |
|----------|--------|
| `POST /papers` | `title` becomes optional. Accepts PDF only. Creates Paper with `status=awaiting_metadata`. Triggers async metadata extraction. Returns `{id, status}` immediately. |
| `GET /papers/{id}/metadata` | **New.** Returns `{status, vlm_result, scholar_suggestion}`. Frontend polls this. |
| `POST /papers/{id}/metadata` | **New.** Accepts confirmed metadata `{title, authors, year, venue, institution, doi}`. Updates Paper fields. Sets `status=pending`. Triggers existing background processing. |

### New Prompt: `backend/prompts/metadata.txt`

Instructs VLM to extract paper metadata from the first page image. Output must be valid JSON matching the schema above. No markdown wrapping.

## Frontend

### Upload Form (LibraryView.tsx)

Remove all manual input fields (title, venue, year, authors). Keep only:
- PDF file picker
- Upload button

On successful upload response `{id}`, redirect to `/papers/{id}/metadata`.

### New Page: `frontend/app/papers/[id]/metadata/page.tsx`

**Loading state:** Spinner with "Extracting metadata from your PDF…" while polling.

**Confirmed state:** Form with fields:
- Title (text input, required)
- Authors (text input)
- Year (number input)
- Venue (text input)
- Institution (text input)
- DOI (text input, populated from Scholar only)

**Scholar suggestion UI per field:**
- If Scholar value matches VLM value: show `✓` in grey
- If Scholar value differs: show `💡 Scholar: "<value>" [adopt]` — clicking adopt copies value into field
- If no Scholar data: show nothing

**Actions:**
- "Confirm & Process" → `POST /papers/{id}/metadata` → redirect to `/papers/{id}/confirm`
- "Cancel" → `DELETE /papers/{id}` → redirect to `/` (Library)

**Polling logic:** `GET /papers/{id}/metadata` every 2s, timeout after 30s. On timeout, show form anyway (fields may be empty).

## Error Handling

- VLM quota/network error during extraction: log warning, set `raw_extracted_metadata=null`, form shows empty fields
- Semantic Scholar rate limit (100 req/5min): catch 429, skip suggestions silently
- User cancels on metadata page: DELETE the paper to avoid orphaned records

## Out of Scope

- Batch upload (multiple PDFs at once)
- DOI-first lookup path (reserved for future improvement)
- Editing metadata after the confirmation step

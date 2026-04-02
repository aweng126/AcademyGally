# Settings & Model Configuration Page — Design Spec

**Date:** 2026-04-01  
**Status:** Approved

---

## Goal

Add a `/settings` page to AcademyGally that lets users configure their personal profile, AI model provider, and application preferences — all at runtime without touching environment variables.

**Phase roadmap:**
- **Phase A (now):** Single-user, singleton DB rows (`user_id = 1`)
- **Phase B:** Multi-user team deployment — add Auth, `user_id` FK already in schema, zero migration
- **Phase C:** Open platform — same schema, add account management layer

---

## Architecture

### Two new DB tables

```sql
-- Singleton in Phase A (user_id = 1 always)
CREATE TABLE user_profile (
    user_id       INTEGER PRIMARY KEY DEFAULT 1,
    display_name  TEXT,
    institution   TEXT,
    research_area TEXT,                    -- 'systems'|'ml'|'nlp'|'security'|'hci'|'other'
    research_interests TEXT,               -- JSON array of strings
    academic_stage TEXT,                   -- 'phd_y1'..'phd_y6'|'postdoc'|'faculty'
    default_view  TEXT DEFAULT 'library',  -- 'library'|'topic'|'browse'
    analysis_language TEXT DEFAULT 'english', -- 'english'|'chinese'|'auto'
    auto_retry    INTEGER DEFAULT 0,       -- boolean
    updated_at    DATETIME
);

CREATE TABLE model_config (
    user_id           INTEGER PRIMARY KEY DEFAULT 1,
    preset            TEXT,     -- 'anthropic'|'glm'|'openai'|'deepseek'|'ollama'|'custom'
    provider          TEXT,     -- 'anthropic'|'openai_compatible'
    anthropic_api_key TEXT,     -- plaintext; masked in API responses
    vlm_api_key       TEXT,     -- plaintext; masked in API responses
    vlm_base_url      TEXT,
    vlm_model         TEXT,
    vlm_text_model    TEXT,     -- NULL means "same as vlm_model"
    last_tested_at    DATETIME,
    last_test_status  TEXT,     -- 'ok'|'failed'|NULL
    last_test_latency_ms INTEGER,
    updated_at        DATETIME
);
```

**API key security (Phase A):** Keys stored plaintext in SQLite (local file, OS-protected). Never returned in full via GET — masked as `••••[last4]` or `null`.  
**Phase B upgrade path:** Add `SECRET_KEY` env var, encrypt with Python `cryptography.fernet`. Frontend unchanged.

### Settings priority chain (vlm_analyzer.py)

```
DB model_config  →  Environment variable  →  Built-in default
```

A new `get_effective_vlm_config()` function in `vlm_analyzer.py` implements this chain. The lazy-initialized client singleton is invalidated (set to `None`) whenever `PUT /settings/model` succeeds.

---

## Backend

### New file: `backend/routers/settings.py`

```
GET  /settings/profile          → ProfileOut
PUT  /settings/profile          body: ProfileIn → ProfileOut

GET  /settings/model            → ModelConfigOut  (keys masked)
PUT  /settings/model            body: ModelConfigIn → ModelConfigOut

POST /settings/model/test       → TestResult
GET  /settings/model/presets    → list[ProviderPreset]
```

**TestResult shape:**
```json
{
  "status": "ok" | "failed",
  "latency_ms": 1243,
  "model": "glm-4v-plus",
  "provider": "openai_compatible",
  "error": null | "401 Unauthorized — API Key invalid"
}
```
Test implementation: send a minimal 10-token prompt ("Hi") to the configured model, measure round-trip time. Uses the same `analyze_text()` path but bypasses result parsing.

**ProviderPreset shape:**
```json
{
  "id": "glm",
  "label": "智谱 GLM",
  "provider": "openai_compatible",
  "base_url": "https://open.bigmodel.cn/api/paas/v4/",
  "vision_models": ["glm-4v-plus", "glm-4v"],
  "text_models": ["glm-4-plus", "glm-4-flash"],
  "api_key_hint": "从 open.bigmodel.cn 获取",
  "docs_url": "https://open.bigmodel.cn/dev/api"
}
```

### Modify: `backend/services/vlm_analyzer.py`

Add `get_effective_vlm_config() -> dict` that queries `model_config` (user_id=1), merges with `os.getenv()` fallbacks. Existing `_vlm_provider()`, `_vlm_model()`, etc. delegate to this function. Client singleton reset on settings update via a module-level `invalidate_vlm_clients()` function called from the PUT handler.

### Modify: `backend/main.py`

Register: `app.include_router(settings.router, prefix="/settings", tags=["settings"])`

### New Alembic migration

`backend/migrations/versions/xxxx_add_settings_tables.py` — creates `user_profile` and `model_config` tables.

---

## Frontend

### Navigation entry point

Modify `frontend/app/page.tsx` header: add a `⚙` icon button (`<Link href="/settings">`) in the top-right. Uses `text-gray-400 hover:text-gray-700` styling, does not compete with main nav tabs.

### New page

`frontend/app/settings/page.tsx` — renders `<SettingsPage />`.

### New components

#### `SettingsPage.tsx`
Two-column layout: left sidebar (120 px) with three nav links (Profile / Model Config / Preferences), right content area renders the active section. Active section tracked in URL hash (`#profile`, `#model`, `#preferences`).

#### `ProfileSection.tsx`
Form fields:
- Display name (text input)
- Institution (text input)
- Research area (select: Systems / ML / NLP / Security / HCI / Other)
- Research interests (tag input: type and press Enter to add, click × to remove)
- Academic stage (select: PhD Y1–Y6 / Postdoc / Faculty / Other)

Save button with success flash ("Saved ✓"). No page reload on save.

#### `ModelConfigSection.tsx`
Three sub-sections stacked vertically:

**1. Config status bar** (always visible at top):
```
🟢 Using DB config — 智谱 GLM (glm-4v-plus) · Last tested: today 14:23 · [Test now]
⚠️  No DB config — Falling back to environment variables
🔴 Config error — Last test failed · [Retry test]
```

**2. Provider preset cards** (6 cards in 3×2 grid):
- Anthropic Claude · 智谱 GLM · OpenAI GPT · DeepSeek · Ollama · Custom
- Active card: border ring (`ring-2 ring-blue-500`)
- Each shows: logo/emoji, name, status badge (Configured / Not configured / Active)
- Clicking a preset auto-fills Base URL and populates model dropdown suggestions

**3. Config form** (shown below cards, updates when preset changes):
- **API Key field**: masked input `••••••••••Yzqy`, [👁 Reveal] toggle, [✏ Edit] → inline input, [🗑 Clear] revert to env var. Below field: source indicator ("From database" / "From environment variable — DB config will take priority if set").
- **Base URL** (hidden for Anthropic): text input, pre-filled by preset.
- **Vision model**: dropdown (preset options) + free-text fallback. Tooltip: "Used for arch figure and eval figure analysis."
- **Text model**: checkbox "Same as vision model" (default checked). When unchecked, shows a second dropdown. Tooltip: "Used for abstract analysis and Writing Coach."
- **Save button** + **[▶ Test Connection]** side by side.

#### `ConnectionTestPanel.tsx`
Inline result panel below the Save/Test row. Shows spinner during test, then success or failure card (see Section 3.4 of design discussion). On failure, maps common HTTP status codes to user-friendly suggestions:
- 401 → "Check API Key for typos or expiry"
- 404 → "Check Base URL — endpoint may have changed"
- 429 → "Rate limited — your API quota may be exhausted"
- Network error → "Cannot reach the endpoint — check Base URL or network"

#### `AppPreferencesSection.tsx`
Three toggles/selects:
- Default view: Radio group (Library / Topic Study / Browse by Module)
- Analysis language: Select (English / 中文 / Follow paper language)
- Auto-retry failed analyses: Toggle switch

Save button. Values persisted to `user_profile` via `PUT /settings/profile`.

### New API functions (`frontend/lib/api.ts`)

```typescript
export const getProfile       = () => request<UserProfile>("/settings/profile");
export const updateProfile    = (body: Partial<UserProfile>) =>
  request<UserProfile>("/settings/profile", { method: "PUT", body: JSON.stringify(body) });

export const getModelConfig   = () => request<ModelConfigOut>("/settings/model");
export const updateModelConfig = (body: ModelConfigIn) =>
  request<ModelConfigOut>("/settings/model", { method: "PUT", body: JSON.stringify(body) });

export const testModelConnection = () =>
  request<TestResult>("/settings/model/test", { method: "POST" });

export const getModelPresets  = () => request<ProviderPreset[]>("/settings/model/presets");
```

### New types (`frontend/lib/types.ts`)

```typescript
interface UserProfile {
  display_name: string | null;
  institution: string | null;
  research_area: string | null;
  research_interests: string[];
  academic_stage: string | null;
  default_view: "library" | "topic" | "browse";
  analysis_language: "english" | "chinese" | "auto";
  auto_retry: boolean;
}

interface ModelConfigOut {
  preset: string | null;
  provider: string | null;
  anthropic_api_key_hint: string | null;  // "••••Yzqy" or null
  vlm_api_key_hint: string | null;
  vlm_base_url: string | null;
  vlm_model: string | null;
  vlm_text_model: string | null;
  last_test_status: "ok" | "failed" | null;
  last_test_latency_ms: number | null;
  last_tested_at: string | null;
  effective_provider: string;   // what's actually active (db or env)
  effective_model: string;
  config_source: "database" | "environment";
}

interface ModelConfigIn {
  preset?: string;
  provider?: string;
  anthropic_api_key?: string;   // full key, only sent on explicit save
  vlm_api_key?: string;
  vlm_base_url?: string;
  vlm_model?: string;
  vlm_text_model?: string | null;
}

interface TestResult {
  status: "ok" | "failed";
  latency_ms: number | null;
  model: string | null;
  provider: string | null;
  error: string | null;
}

interface ProviderPreset {
  id: string;
  label: string;
  provider: "anthropic" | "openai_compatible";
  base_url: string | null;
  vision_models: string[];
  text_models: string[];
  api_key_hint: string;
  docs_url: string;
}
```

---

## File Change Summary

| File | Change |
|------|--------|
| `backend/models/settings.py` | **New** — UserProfile + ModelConfig SQLAlchemy models |
| `backend/routers/settings.py` | **New** — all settings endpoints |
| `backend/services/vlm_analyzer.py` | **Modify** — add `get_effective_vlm_config()`, `invalidate_vlm_clients()` |
| `backend/main.py` | **Modify** — register settings router |
| `backend/migrations/versions/xxxx_add_settings_tables.py` | **New** — Alembic migration |
| `frontend/app/settings/page.tsx` | **New** — route entry point |
| `frontend/app/page.tsx` | **Modify** — add ⚙ icon to header |
| `frontend/components/settings/SettingsPage.tsx` | **New** |
| `frontend/components/settings/ProfileSection.tsx` | **New** |
| `frontend/components/settings/ModelConfigSection.tsx` | **New** |
| `frontend/components/settings/ProviderPresetCard.tsx` | **New** |
| `frontend/components/settings/ConnectionTestPanel.tsx` | **New** |
| `frontend/components/settings/AppPreferencesSection.tsx` | **New** |
| `frontend/lib/types.ts` | **Modify** — add settings types |
| `frontend/lib/api.ts` | **Modify** — add settings API functions |

---

## Verification

1. Open `/settings` → three-section sidebar renders, no JS errors
2. Profile: fill in display name + institution → Save → refresh → values persist
3. Model Config: select "智谱 GLM" preset → Base URL auto-fills → enter API Key → Save → API Key masked to `••••Yzqy`
4. Test Connection → green success card with latency, model name
5. Test Connection with wrong key → red failure card with "Check API Key" suggestion
6. Upload new paper → abstract analysis uses the DB-configured model (not env var)
7. Clear DB config → system falls back to env var, status bar shows "Using environment variables"
8. `GET /settings/model` response never contains full API key — only hint string

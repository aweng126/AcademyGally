# Settings & Model Configuration Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/settings` page that lets users configure their profile and runtime AI model provider without touching `.env` files.

**Architecture:** Two new SQLite tables (`user_profile`, `model_config`, both with `user_id INTEGER PRIMARY KEY DEFAULT 1` for Phase A singleton). A new FastAPI router at `/settings` handles all CRUD + connection-test endpoints. `vlm_analyzer.py` gains `get_effective_vlm_config()` that reads DB first, falls back to env vars, and `invalidate_vlm_clients()` that resets the lazy singletons on config save. Frontend is a standalone `/settings` Next.js App Router page with a 3-section sidebar layout.

**Tech Stack:** Python/FastAPI/SQLAlchemy/Alembic (backend), Next.js App Router/TypeScript/Tailwind (frontend), SQLite (Phase A storage).

---

## File Map

### Backend — New
| File | Responsibility |
|------|----------------|
| `backend/models/settings.py` | SQLAlchemy models: `UserProfile`, `ModelConfig` |
| `backend/routers/settings.py` | All 5 settings endpoints + 6 provider presets |
| `backend/migrations/versions/b1c2d3e4f5a6_add_settings_tables.py` | Alembic migration creating the two tables |

### Backend — Modified
| File | Change |
|------|--------|
| `backend/services/vlm_analyzer.py` | Add `get_effective_vlm_config()`, `invalidate_vlm_clients()`, wire provider helpers to use DB config |
| `backend/main.py` | Register `settings.router` with prefix `/settings` |

### Frontend — New
| File | Responsibility |
|------|----------------|
| `frontend/app/settings/page.tsx` | App Router entry point |
| `frontend/components/settings/SettingsPage.tsx` | Two-column layout + hash-based section routing |
| `frontend/components/settings/ProfileSection.tsx` | Profile form (name, institution, research area, interests, stage) |
| `frontend/components/settings/ModelConfigSection.tsx` | Status bar + preset cards + config form |
| `frontend/components/settings/ProviderPresetCard.tsx` | Single preset card with ring highlight |
| `frontend/components/settings/ConnectionTestPanel.tsx` | Spinner → success/error result card |
| `frontend/components/settings/AppPreferencesSection.tsx` | Default view / analysis language / auto-retry |

### Frontend — Modified
| File | Change |
|------|--------|
| `frontend/lib/types.ts` | Add `UserProfile`, `ModelConfigOut`, `ModelConfigIn`, `TestResult`, `ProviderPreset` |
| `frontend/lib/api.ts` | Add `getProfile`, `updateProfile`, `getModelConfig`, `updateModelConfig`, `testModelConnection`, `getModelPresets` |
| `frontend/app/page.tsx` | Add `⚙` icon link in header top-right |

---

## Task 1: SQLAlchemy Models

**Files:**
- Create: `backend/models/settings.py`
- Modify: `backend/models/__init__.py` (if it imports models)

- [ ] **Step 1: Write the model file**

```python
# backend/models/settings.py
from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class UserProfile(Base):
    __tablename__ = "user_profile"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    display_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    institution: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    research_area: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    research_interests: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array
    academic_stage: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    default_view: Mapped[str] = mapped_column(Text, nullable=False, default="library")
    analysis_language: Mapped[str] = mapped_column(Text, nullable=False, default="english")
    auto_retry: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # boolean
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class ModelConfig(Base):
    __tablename__ = "model_config"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    preset: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    provider: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    anthropic_api_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vlm_api_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vlm_base_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vlm_model: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vlm_text_model: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_tested_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_test_status: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_test_latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
```

- [ ] **Step 2: Verify the models file is syntactically correct**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally/backend
python -c "from models.settings import UserProfile, ModelConfig; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally
git add backend/models/settings.py
git commit -m "feat: add UserProfile and ModelConfig SQLAlchemy models"
```

---

## Task 2: Alembic Migration

**Files:**
- Create: `backend/migrations/versions/b1c2d3e4f5a6_add_settings_tables.py`

- [ ] **Step 1: Write the migration file**

```python
# backend/migrations/versions/b1c2d3e4f5a6_add_settings_tables.py
"""add_settings_tables

Revision ID: b1c2d3e4f5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-04-01

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_profile',
        sa.Column('user_id', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('display_name', sa.Text(), nullable=True),
        sa.Column('institution', sa.Text(), nullable=True),
        sa.Column('research_area', sa.Text(), nullable=True),
        sa.Column('research_interests', sa.Text(), nullable=True),
        sa.Column('academic_stage', sa.Text(), nullable=True),
        sa.Column('default_view', sa.Text(), nullable=False, server_default='library'),
        sa.Column('analysis_language', sa.Text(), nullable=False, server_default='english'),
        sa.Column('auto_retry', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('user_id'),
    )
    op.create_table(
        'model_config',
        sa.Column('user_id', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('preset', sa.Text(), nullable=True),
        sa.Column('provider', sa.Text(), nullable=True),
        sa.Column('anthropic_api_key', sa.Text(), nullable=True),
        sa.Column('vlm_api_key', sa.Text(), nullable=True),
        sa.Column('vlm_base_url', sa.Text(), nullable=True),
        sa.Column('vlm_model', sa.Text(), nullable=True),
        sa.Column('vlm_text_model', sa.Text(), nullable=True),
        sa.Column('last_tested_at', sa.DateTime(), nullable=True),
        sa.Column('last_test_status', sa.Text(), nullable=True),
        sa.Column('last_test_latency_ms', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('user_id'),
    )


def downgrade() -> None:
    op.drop_table('model_config')
    op.drop_table('user_profile')
```

- [ ] **Step 2: Run the migration**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally/backend
alembic upgrade head
```

Expected output ends with: `Running upgrade a1b2c3d4e5f6 -> b1c2d3e4f5a6, add_settings_tables`

- [ ] **Step 3: Verify tables were created**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally/backend
python -c "
from database import engine
from sqlalchemy import inspect
i = inspect(engine)
print(i.get_table_names())
"
```

Expected: list contains `'user_profile'` and `'model_config'`

- [ ] **Step 4: Commit**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally
git add backend/migrations/versions/b1c2d3e4f5a6_add_settings_tables.py
git commit -m "feat: Alembic migration adding user_profile and model_config tables"
```

---

## Task 3: vlm_analyzer.py — DB Config Integration

**Files:**
- Modify: `backend/services/vlm_analyzer.py`

The goal: `get_effective_vlm_config()` reads `model_config` row (user_id=1), falls back to env vars. `invalidate_vlm_clients()` sets both singletons to None. Existing `_provider()`, `_vlm_model()`, `_vlm_text_model()`, `_get_anthropic_client()`, `_get_openai_client()` delegate to the effective config.

- [ ] **Step 1: Write a test for `get_effective_vlm_config`**

Create `backend/tests/test_vlm_config.py`:

```python
# backend/tests/test_vlm_config.py
import os
import pytest
from unittest.mock import patch, MagicMock


def test_get_effective_vlm_config_env_fallback():
    """When no DB row exists, values come from env vars."""
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None

    with patch.dict(os.environ, {
        "VLM_PROVIDER": "anthropic",
        "VLM_MODEL": "claude-opus-4-6",
        "ANTHROPIC_API_KEY": "sk-test",
    }):
        from services.vlm_analyzer import get_effective_vlm_config
        cfg = get_effective_vlm_config(mock_db)

    assert cfg["provider"] == "anthropic"
    assert cfg["vlm_model"] == "claude-opus-4-6"
    assert cfg["source"] == "environment"


def test_get_effective_vlm_config_db_takes_priority():
    """DB row overrides env vars."""
    mock_row = MagicMock()
    mock_row.provider = "openai_compatible"
    mock_row.vlm_model = "glm-4v-plus"
    mock_row.vlm_base_url = "https://open.bigmodel.cn/api/paas/v4/"
    mock_row.vlm_api_key = "db-key"
    mock_row.anthropic_api_key = None
    mock_row.vlm_text_model = None
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = mock_row

    with patch.dict(os.environ, {"VLM_PROVIDER": "anthropic", "VLM_MODEL": "claude-old"}):
        from services import vlm_analyzer
        import importlib
        importlib.reload(vlm_analyzer)
        cfg = vlm_analyzer.get_effective_vlm_config(mock_db)

    assert cfg["provider"] == "openai_compatible"
    assert cfg["vlm_model"] == "glm-4v-plus"
    assert cfg["source"] == "database"


def test_invalidate_vlm_clients_resets_singletons():
    from services import vlm_analyzer
    import importlib
    importlib.reload(vlm_analyzer)
    # Set singletons to a truthy value
    vlm_analyzer._anthropic_client = object()
    vlm_analyzer._openai_client = object()

    vlm_analyzer.invalidate_vlm_clients()

    assert vlm_analyzer._anthropic_client is None
    assert vlm_analyzer._openai_client is None
```

- [ ] **Step 2: Run to see it fail**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally/backend
python -m pytest tests/test_vlm_config.py -v 2>&1 | head -30
```

Expected: FAILED — `ImportError` or `AttributeError: module has no attribute 'get_effective_vlm_config'`

- [ ] **Step 3: Add `get_effective_vlm_config` and `invalidate_vlm_clients` to vlm_analyzer.py**

In `backend/services/vlm_analyzer.py`, after the existing imports add:

```python
# at top — add this import
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from sqlalchemy.orm import Session
```

Replace the entire block from `def _provider()` through `def _get_openai_client()` with:

```python
# ---------------------------------------------------------------------------
# Effective config — DB first, env fallback
# ---------------------------------------------------------------------------

def get_effective_vlm_config(db=None) -> dict:
    """
    Returns the effective VLM configuration as a plain dict.
    Priority: DB model_config row (user_id=1)  →  environment variables  →  built-in defaults.
    Accepts an optional SQLAlchemy Session; if None, falls back to env only.
    """
    row = None
    if db is not None:
        try:
            from models.settings import ModelConfig
            row = db.query(ModelConfig).filter(ModelConfig.user_id == 1).first()
        except Exception:
            row = None

    if row and row.provider:
        return {
            "provider": row.provider,
            "vlm_model": row.vlm_model or os.getenv("VLM_MODEL", "glm-4v-plus"),
            "vlm_text_model": row.vlm_text_model or row.vlm_model or os.getenv("VLM_TEXT_MODEL", os.getenv("VLM_MODEL", "glm-4v-plus")),
            "vlm_base_url": row.vlm_base_url or os.getenv("VLM_BASE_URL", "https://api.openai.com/v1"),
            "vlm_api_key": row.vlm_api_key or os.getenv("VLM_API_KEY", ""),
            "anthropic_api_key": row.anthropic_api_key or os.getenv("ANTHROPIC_API_KEY", ""),
            "source": "database",
        }

    return {
        "provider": os.getenv("VLM_PROVIDER", "anthropic").lower(),
        "vlm_model": os.getenv("VLM_MODEL", "claude-opus-4-6") if os.getenv("VLM_PROVIDER", "anthropic").lower() == "anthropic" else os.getenv("VLM_MODEL", "glm-4v-plus"),
        "vlm_text_model": os.getenv("VLM_TEXT_MODEL", os.getenv("VLM_MODEL", "")),
        "vlm_base_url": os.getenv("VLM_BASE_URL", "https://api.openai.com/v1"),
        "vlm_api_key": os.getenv("VLM_API_KEY", ""),
        "anthropic_api_key": os.getenv("ANTHROPIC_API_KEY", ""),
        "source": "environment",
    }


def invalidate_vlm_clients() -> None:
    """Reset the lazy client singletons so next call re-creates them with fresh config."""
    global _anthropic_client, _openai_client
    _anthropic_client = None
    _openai_client = None


# ---------------------------------------------------------------------------
# Provider helpers (delegate to effective config — env-only, no DB session here)
# ---------------------------------------------------------------------------

def _provider() -> str:
    return get_effective_vlm_config()["provider"]


def _vlm_model() -> str:
    return get_effective_vlm_config()["vlm_model"]


def _vlm_text_model() -> str:
    cfg = get_effective_vlm_config()
    return cfg["vlm_text_model"] or cfg["vlm_model"]
```

Also update `_get_openai_client()` to read from effective config:

```python
def _get_openai_client():
    global _openai_client
    if _openai_client is None:
        from openai import OpenAI
        cfg = get_effective_vlm_config()
        _openai_client = OpenAI(
            api_key=cfg["vlm_api_key"],
            base_url=cfg["vlm_base_url"],
        )
    return _openai_client
```

And `_get_anthropic_client()` to use effective config key:

```python
def _get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None:
        import anthropic
        cfg = get_effective_vlm_config()
        _anthropic_client = anthropic.Anthropic(api_key=cfg["anthropic_api_key"] or None)
    return _anthropic_client
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally/backend
python -m pytest tests/test_vlm_config.py -v
```

Expected: 3 tests PASSED

- [ ] **Step 5: Commit**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally
git add backend/services/vlm_analyzer.py backend/tests/test_vlm_config.py
git commit -m "feat: add get_effective_vlm_config and invalidate_vlm_clients to vlm_analyzer"
```

---

## Task 4: Settings Router — Backend

**Files:**
- Create: `backend/routers/settings.py`

- [ ] **Step 1: Write the router**

```python
# backend/routers/settings.py
import json
import time
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.settings import UserProfile, ModelConfig
from services.vlm_analyzer import get_effective_vlm_config, invalidate_vlm_clients

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ProfileIn(BaseModel):
    display_name: Optional[str] = None
    institution: Optional[str] = None
    research_area: Optional[str] = None
    research_interests: Optional[list[str]] = None
    academic_stage: Optional[str] = None
    default_view: Optional[str] = None
    analysis_language: Optional[str] = None
    auto_retry: Optional[bool] = None


class ProfileOut(BaseModel):
    display_name: Optional[str]
    institution: Optional[str]
    research_area: Optional[str]
    research_interests: list[str]
    academic_stage: Optional[str]
    default_view: str
    analysis_language: str
    auto_retry: bool


class ModelConfigIn(BaseModel):
    preset: Optional[str] = None
    provider: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    vlm_api_key: Optional[str] = None
    vlm_base_url: Optional[str] = None
    vlm_model: Optional[str] = None
    vlm_text_model: Optional[str] = None


class ModelConfigOut(BaseModel):
    preset: Optional[str]
    provider: Optional[str]
    anthropic_api_key_hint: Optional[str]
    vlm_api_key_hint: Optional[str]
    vlm_base_url: Optional[str]
    vlm_model: Optional[str]
    vlm_text_model: Optional[str]
    last_test_status: Optional[str]
    last_test_latency_ms: Optional[int]
    last_tested_at: Optional[str]
    effective_provider: str
    effective_model: str
    config_source: str


class TestResult(BaseModel):
    status: str
    latency_ms: Optional[int]
    model: Optional[str]
    provider: Optional[str]
    error: Optional[str]


class ProviderPreset(BaseModel):
    id: str
    label: str
    provider: str
    base_url: Optional[str]
    vision_models: list[str]
    text_models: list[str]
    api_key_hint: str
    docs_url: str


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_PRESETS: list[dict] = [
    {
        "id": "anthropic",
        "label": "Anthropic Claude",
        "provider": "anthropic",
        "base_url": None,
        "vision_models": ["claude-opus-4-6", "claude-sonnet-4-6"],
        "text_models": ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
        "api_key_hint": "Get from console.anthropic.com",
        "docs_url": "https://docs.anthropic.com",
    },
    {
        "id": "glm",
        "label": "智谱 GLM",
        "provider": "openai_compatible",
        "base_url": "https://open.bigmodel.cn/api/paas/v4/",
        "vision_models": ["glm-4v-plus", "glm-4v"],
        "text_models": ["glm-4-plus", "glm-4-flash"],
        "api_key_hint": "从 open.bigmodel.cn 获取",
        "docs_url": "https://open.bigmodel.cn/dev/api",
    },
    {
        "id": "openai",
        "label": "OpenAI GPT",
        "provider": "openai_compatible",
        "base_url": "https://api.openai.com/v1",
        "vision_models": ["gpt-4o", "gpt-4o-mini"],
        "text_models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
        "api_key_hint": "Get from platform.openai.com",
        "docs_url": "https://platform.openai.com/docs",
    },
    {
        "id": "deepseek",
        "label": "DeepSeek",
        "provider": "openai_compatible",
        "base_url": "https://api.deepseek.com/v1",
        "vision_models": ["deepseek-chat"],
        "text_models": ["deepseek-chat", "deepseek-reasoner"],
        "api_key_hint": "Get from platform.deepseek.com",
        "docs_url": "https://platform.deepseek.com/api-docs",
    },
    {
        "id": "ollama",
        "label": "Ollama",
        "provider": "openai_compatible",
        "base_url": "http://localhost:11434/v1",
        "vision_models": ["llava", "llava-llama3"],
        "text_models": ["llama3", "mistral"],
        "api_key_hint": "Not required for local Ollama",
        "docs_url": "https://ollama.com/library",
    },
    {
        "id": "custom",
        "label": "Custom",
        "provider": "openai_compatible",
        "base_url": None,
        "vision_models": [],
        "text_models": [],
        "api_key_hint": "Enter your API key",
        "docs_url": "",
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mask_key(key: Optional[str]) -> Optional[str]:
    """Return ••••[last4] or None."""
    if not key:
        return None
    if len(key) <= 4:
        return "••••"
    return f"••••{key[-4:]}"


def _get_or_create_profile(db: Session) -> UserProfile:
    row = db.query(UserProfile).filter(UserProfile.user_id == 1).first()
    if row is None:
        row = UserProfile(user_id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _get_or_create_model_config(db: Session) -> ModelConfig:
    row = db.query(ModelConfig).filter(ModelConfig.user_id == 1).first()
    if row is None:
        row = ModelConfig(user_id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _profile_out(row: UserProfile) -> ProfileOut:
    interests: list[str] = []
    if row.research_interests:
        try:
            interests = json.loads(row.research_interests)
        except Exception:
            interests = []
    return ProfileOut(
        display_name=row.display_name,
        institution=row.institution,
        research_area=row.research_area,
        research_interests=interests,
        academic_stage=row.academic_stage,
        default_view=row.default_view or "library",
        analysis_language=row.analysis_language or "english",
        auto_retry=bool(row.auto_retry),
    )


def _model_config_out(row: ModelConfig, db: Session) -> ModelConfigOut:
    cfg = get_effective_vlm_config(db)
    return ModelConfigOut(
        preset=row.preset,
        provider=row.provider,
        anthropic_api_key_hint=_mask_key(row.anthropic_api_key),
        vlm_api_key_hint=_mask_key(row.vlm_api_key),
        vlm_base_url=row.vlm_base_url,
        vlm_model=row.vlm_model,
        vlm_text_model=row.vlm_text_model,
        last_test_status=row.last_test_status,
        last_test_latency_ms=row.last_test_latency_ms,
        last_tested_at=row.last_tested_at.isoformat() if row.last_tested_at else None,
        effective_provider=cfg["provider"],
        effective_model=cfg["vlm_model"],
        config_source=cfg["source"],
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/profile")
def get_profile(db: Session = Depends(get_db)) -> ProfileOut:
    row = _get_or_create_profile(db)
    return _profile_out(row)


@router.put("/profile")
def update_profile(body: ProfileIn, db: Session = Depends(get_db)) -> ProfileOut:
    row = _get_or_create_profile(db)
    if body.display_name is not None:
        row.display_name = body.display_name
    if body.institution is not None:
        row.institution = body.institution
    if body.research_area is not None:
        row.research_area = body.research_area
    if body.research_interests is not None:
        row.research_interests = json.dumps(body.research_interests)
    if body.academic_stage is not None:
        row.academic_stage = body.academic_stage
    if body.default_view is not None:
        row.default_view = body.default_view
    if body.analysis_language is not None:
        row.analysis_language = body.analysis_language
    if body.auto_retry is not None:
        row.auto_retry = 1 if body.auto_retry else 0
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _profile_out(row)


@router.get("/model")
def get_model_config(db: Session = Depends(get_db)) -> ModelConfigOut:
    row = _get_or_create_model_config(db)
    return _model_config_out(row, db)


@router.put("/model")
def update_model_config(body: ModelConfigIn, db: Session = Depends(get_db)) -> ModelConfigOut:
    row = _get_or_create_model_config(db)
    if body.preset is not None:
        row.preset = body.preset
    if body.provider is not None:
        row.provider = body.provider
    if body.anthropic_api_key is not None:
        row.anthropic_api_key = body.anthropic_api_key if body.anthropic_api_key else None
    if body.vlm_api_key is not None:
        row.vlm_api_key = body.vlm_api_key if body.vlm_api_key else None
    if body.vlm_base_url is not None:
        row.vlm_base_url = body.vlm_base_url if body.vlm_base_url else None
    if body.vlm_model is not None:
        row.vlm_model = body.vlm_model if body.vlm_model else None
    if body.vlm_text_model is not None:
        row.vlm_text_model = body.vlm_text_model if body.vlm_text_model else None
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    invalidate_vlm_clients()
    return _model_config_out(row, db)


@router.post("/model/test")
def test_model_connection(db: Session = Depends(get_db)) -> TestResult:
    cfg = get_effective_vlm_config(db)
    provider = cfg["provider"]
    model = cfg["vlm_model"]
    start = time.time()
    try:
        if provider == "anthropic":
            import anthropic
            key = cfg["anthropic_api_key"]
            if not key:
                raise ValueError("No Anthropic API key configured")
            client = anthropic.Anthropic(api_key=key)
            client.messages.create(
                model=model,
                max_tokens=10,
                messages=[{"role": "user", "content": "Hi"}],
            )
        else:
            from openai import OpenAI
            key = cfg["vlm_api_key"]
            base_url = cfg["vlm_base_url"]
            if not key:
                raise ValueError("No API key configured")
            client = OpenAI(api_key=key, base_url=base_url)
            client.chat.completions.create(
                model=model,
                max_tokens=10,
                messages=[{"role": "user", "content": "Hi"}],
            )
        latency_ms = int((time.time() - start) * 1000)
        row = _get_or_create_model_config(db)
        row.last_tested_at = datetime.utcnow()
        row.last_test_status = "ok"
        row.last_test_latency_ms = latency_ms
        db.commit()
        return TestResult(status="ok", latency_ms=latency_ms, model=model, provider=provider, error=None)
    except Exception as e:
        latency_ms = int((time.time() - start) * 1000)
        row = _get_or_create_model_config(db)
        row.last_tested_at = datetime.utcnow()
        row.last_test_status = "failed"
        row.last_test_latency_ms = latency_ms
        db.commit()
        error_msg = str(e)
        # Map common HTTP error codes to user-friendly messages
        if "401" in error_msg:
            error_msg = "401 Unauthorized — Check API Key for typos or expiry"
        elif "404" in error_msg:
            error_msg = "404 Not Found — Check Base URL, endpoint may have changed"
        elif "429" in error_msg:
            error_msg = "429 Rate Limited — Your API quota may be exhausted"
        elif "Name or service not known" in error_msg or "Connection refused" in error_msg or "Failed to establish" in error_msg:
            error_msg = "Cannot reach the endpoint — check Base URL or network"
        logger.warning("Model connection test failed: %s", e)
        return TestResult(status="failed", latency_ms=latency_ms, model=model, provider=provider, error=error_msg)


@router.get("/model/presets")
def get_model_presets() -> list[ProviderPreset]:
    return [ProviderPreset(**p) for p in _PRESETS]
```

- [ ] **Step 2: Write a smoke test**

Create `backend/tests/test_settings_router.py`:

```python
# backend/tests/test_settings_router.py
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


def _make_app():
    from fastapi import FastAPI
    from routers.settings import router
    app = FastAPI()
    app.include_router(router, prefix="/settings")
    return app


def test_get_profile_creates_singleton():
    app = _make_app()
    client = TestClient(app)
    with patch("routers.settings.get_db") as mock_get_db:
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        # Simulate db.add() + db.refresh() setting attributes
        def fake_refresh(obj):
            obj.display_name = None
            obj.institution = None
            obj.research_area = None
            obj.research_interests = None
            obj.academic_stage = None
            obj.default_view = "library"
            obj.analysis_language = "english"
            obj.auto_retry = 0
        mock_db.refresh.side_effect = fake_refresh
        mock_get_db.return_value = iter([mock_db])
        resp = client.get("/settings/profile")
    assert resp.status_code == 200
    data = resp.json()
    assert data["default_view"] == "library"
    assert data["auto_retry"] is False


def test_get_model_presets_returns_six():
    app = _make_app()
    client = TestClient(app)
    resp = client.get("/settings/model/presets")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 6
    ids = [p["id"] for p in data]
    assert "anthropic" in ids
    assert "glm" in ids
    assert "custom" in ids


def test_mask_key():
    from routers.settings import _mask_key
    assert _mask_key(None) is None
    assert _mask_key("sk-abcd1234") == "••••1234"
    assert _mask_key("ab") == "••••"
```

- [ ] **Step 3: Run the tests**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally/backend
python -m pytest tests/test_settings_router.py -v
```

Expected: 3 tests PASSED

- [ ] **Step 4: Commit**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally
git add backend/routers/settings.py backend/tests/test_settings_router.py
git commit -m "feat: add settings router with profile/model/test/presets endpoints"
```

---

## Task 5: Register Settings Router in main.py

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add the import and router registration**

In `backend/main.py`, add `settings` to the routers import line and include_router call:

```python
# Change line:
from routers import papers, content, topics, writing_coach
# To:
from routers import papers, content, topics, writing_coach, settings
```

Add after the writing_coach line:

```python
app.include_router(settings.router, prefix="/settings", tags=["settings"])
```

The full updated section looks like:

```python
from routers import papers, content, topics, writing_coach, settings
...
app.include_router(papers.router, prefix="/papers", tags=["papers"])
app.include_router(content.router, prefix="/content", tags=["content"])
app.include_router(topics.router, prefix="/topics", tags=["topics"])
app.include_router(writing_coach.router, prefix="/writing-coach", tags=["writing_coach"])
app.include_router(settings.router, prefix="/settings", tags=["settings"])
```

- [ ] **Step 2: Verify the app starts cleanly**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally/backend
python -c "from main import app; print('Routes OK:', [r.path for r in app.routes if '/settings' in str(r.path)])"
```

Expected: prints a list including `/settings/profile`, `/settings/model`, etc.

- [ ] **Step 3: Commit**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally
git add backend/main.py
git commit -m "feat: register settings router in FastAPI app"
```

---

## Task 6: Frontend Types & API Functions

**Files:**
- Modify: `frontend/lib/types.ts`
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Add types to types.ts**

Append to the end of `frontend/lib/types.ts`:

```typescript
// ─── Settings (Feature: Settings Page) ────────────────────────────────────

export interface UserProfile {
  display_name: string | null;
  institution: string | null;
  research_area: string | null;
  research_interests: string[];
  academic_stage: string | null;
  default_view: "library" | "topic" | "browse";
  analysis_language: "english" | "chinese" | "auto";
  auto_retry: boolean;
}

export interface ModelConfigOut {
  preset: string | null;
  provider: string | null;
  anthropic_api_key_hint: string | null;
  vlm_api_key_hint: string | null;
  vlm_base_url: string | null;
  vlm_model: string | null;
  vlm_text_model: string | null;
  last_test_status: "ok" | "failed" | null;
  last_test_latency_ms: number | null;
  last_tested_at: string | null;
  effective_provider: string;
  effective_model: string;
  config_source: "database" | "environment";
}

export interface ModelConfigIn {
  preset?: string;
  provider?: string;
  anthropic_api_key?: string;
  vlm_api_key?: string;
  vlm_base_url?: string;
  vlm_model?: string;
  vlm_text_model?: string | null;
}

export interface TestResult {
  status: "ok" | "failed";
  latency_ms: number | null;
  model: string | null;
  provider: string | null;
  error: string | null;
}

export interface ProviderPreset {
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

- [ ] **Step 2: Add API functions to api.ts**

Append to the end of `frontend/lib/api.ts`:

```typescript
// ─── Settings ───────────────────────────────────────────────────────────────

import type { UserProfile, ModelConfigOut, ModelConfigIn, TestResult, ProviderPreset } from "./types";

export const getProfile = () => request<UserProfile>("/settings/profile");

export const updateProfile = (body: Partial<UserProfile>) =>
  request<UserProfile>("/settings/profile", {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const getModelConfig = () => request<ModelConfigOut>("/settings/model");

export const updateModelConfig = (body: ModelConfigIn) =>
  request<ModelConfigOut>("/settings/model", {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const testModelConnection = () =>
  request<TestResult>("/settings/model/test", { method: "POST" });

export const getModelPresets = () => request<ProviderPreset[]>("/settings/model/presets");
```

Note: The `import type` statement at the top of the append block needs to be merged with the existing import at line 1 of `api.ts`. Instead of appending a new import, add `UserProfile, ModelConfigOut, ModelConfigIn, TestResult, ProviderPreset` to the existing import on line 1:

```typescript
import type { Paper, ContentItem, Topic, TopicPaper, UserAnnotation, PaperMetadataResponse, VenueEntry, CoachResponse, PhraseItem, PhraseFavorite, UserProfile, ModelConfigOut, ModelConfigIn, TestResult, ProviderPreset } from "./types";
```

Then append only the function definitions (without the import line) to the end of `api.ts`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (no errors)

- [ ] **Step 4: Commit**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally
git add frontend/lib/types.ts frontend/lib/api.ts
git commit -m "feat: add settings types and API functions to frontend"
```

---

## Task 7: Settings Page Entry Point & Layout

**Files:**
- Create: `frontend/app/settings/page.tsx`
- Create: `frontend/components/settings/SettingsPage.tsx`

- [ ] **Step 1: Create the App Router page**

```typescript
// frontend/app/settings/page.tsx
import SettingsPage from "@/components/settings/SettingsPage";

export default function SettingsRoute() {
  return <SettingsPage />;
}
```

- [ ] **Step 2: Create SettingsPage.tsx with sidebar layout**

```typescript
// frontend/components/settings/SettingsPage.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProfileSection from "./ProfileSection";
import ModelConfigSection from "./ModelConfigSection";
import AppPreferencesSection from "./AppPreferencesSection";

type Section = "profile" | "model" | "preferences";

const NAV_ITEMS: { key: Section; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "model", label: "Model Config" },
  { key: "preferences", label: "Preferences" },
];

export default function SettingsPage() {
  const [active, setActive] = useState<Section>("profile");

  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as Section;
    if (["profile", "model", "preferences"].includes(hash)) {
      setActive(hash);
    }
    const onHash = () => {
      const h = window.location.hash.replace("#", "") as Section;
      if (["profile", "model", "preferences"].includes(h)) setActive(h);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-800">
            ← Back
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 flex gap-8">
        {/* Left sidebar */}
        <nav className="w-32 flex-shrink-0">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ key, label }) => (
              <li key={key}>
                <a
                  href={`#${key}`}
                  onClick={() => setActive(key)}
                  className={`block rounded px-3 py-2 text-sm font-medium transition ${
                    active === key
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content */}
        <main className="flex-1 min-w-0">
          {active === "profile" && <ProfileSection />}
          {active === "model" && <ModelConfigSection />}
          {active === "preferences" && <AppPreferencesSection />}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify the page renders (build check)**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (ProfileSection, ModelConfigSection, AppPreferencesSection will be stubs for now — create them as empty exports)

Create temporary stubs (these will be replaced in later tasks):

```typescript
// frontend/components/settings/ProfileSection.tsx
export default function ProfileSection() { return <div>Profile</div>; }

// frontend/components/settings/ModelConfigSection.tsx
export default function ModelConfigSection() { return <div>Model Config</div>; }

// frontend/components/settings/AppPreferencesSection.tsx
export default function AppPreferencesSection() { return <div>Preferences</div>; }
```

- [ ] **Step 4: Commit**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally
git add frontend/app/settings/page.tsx frontend/components/settings/
git commit -m "feat: add settings page route and layout with sidebar navigation"
```

---

## Task 8: ProfileSection Component

**Files:**
- Modify: `frontend/components/settings/ProfileSection.tsx` (replace stub)

- [ ] **Step 1: Write ProfileSection**

```typescript
// frontend/components/settings/ProfileSection.tsx
"use client";

import { useEffect, useState } from "react";
import { getProfile, updateProfile } from "@/lib/api";
import type { UserProfile } from "@/lib/types";

const RESEARCH_AREAS = [
  { value: "systems", label: "Systems" },
  { value: "ml", label: "ML" },
  { value: "nlp", label: "NLP" },
  { value: "security", label: "Security" },
  { value: "hci", label: "HCI" },
  { value: "other", label: "Other" },
];

const ACADEMIC_STAGES = [
  { value: "phd_y1", label: "PhD Y1" },
  { value: "phd_y2", label: "PhD Y2" },
  { value: "phd_y3", label: "PhD Y3" },
  { value: "phd_y4", label: "PhD Y4" },
  { value: "phd_y5", label: "PhD Y5" },
  { value: "phd_y6", label: "PhD Y6" },
  { value: "postdoc", label: "Postdoc" },
  { value: "faculty", label: "Faculty" },
  { value: "other", label: "Other" },
];

export default function ProfileSection() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [institution, setInstitution] = useState("");
  const [researchArea, setResearchArea] = useState("");
  const [academicStage, setAcademicStage] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProfile().then((p) => {
      setProfile(p);
      setDisplayName(p.display_name ?? "");
      setInstitution(p.institution ?? "");
      setResearchArea(p.research_area ?? "");
      setAcademicStage(p.academic_stage ?? "");
      setInterests(p.research_interests ?? []);
    });
  }, []);

  const handleInterestKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && interestInput.trim()) {
      e.preventDefault();
      const val = interestInput.trim();
      if (!interests.includes(val)) setInterests((prev) => [...prev, val]);
      setInterestInput("");
    }
  };

  const removeInterest = (tag: string) => {
    setInterests((prev) => prev.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateProfile({
        display_name: displayName || null,
        institution: institution || null,
        research_area: researchArea || null,
        research_interests: interests,
        academic_stage: academicStage || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return <div className="text-sm text-gray-400">Loading…</div>;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-5">Profile</h2>
      <div className="flex flex-col gap-4 max-w-lg">
        {/* Display name */}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Display name</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Your name"
          />
        </label>

        {/* Institution */}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Institution</span>
          <input
            type="text"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="University or lab"
          />
        </label>

        {/* Research area */}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Research area</span>
          <select
            value={researchArea}
            onChange={(e) => setResearchArea(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">— Select —</option>
            {RESEARCH_AREAS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </label>

        {/* Research interests */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Research interests</span>
          <div className="flex flex-wrap gap-1 mb-1">
            {interests.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
              >
                {tag}
                <button onClick={() => removeInterest(tag)} className="text-blue-400 hover:text-blue-700">×</button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={interestInput}
            onChange={(e) => setInterestInput(e.target.value)}
            onKeyDown={handleInterestKeyDown}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Type and press Enter to add"
          />
        </div>

        {/* Academic stage */}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Academic stage</span>
          <select
            value={academicStage}
            onChange={(e) => setAcademicStage(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">— Select —</option>
            {ACADEMIC_STAGES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="self-start rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {saved ? "Saved ✓" : saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally
git add frontend/components/settings/ProfileSection.tsx
git commit -m "feat: implement ProfileSection with form fields and save"
```

---

## Task 9: AppPreferencesSection Component

**Files:**
- Modify: `frontend/components/settings/AppPreferencesSection.tsx` (replace stub)

- [ ] **Step 1: Write AppPreferencesSection**

```typescript
// frontend/components/settings/AppPreferencesSection.tsx
"use client";

import { useEffect, useState } from "react";
import { getProfile, updateProfile } from "@/lib/api";

export default function AppPreferencesSection() {
  const [defaultView, setDefaultView] = useState<"library" | "topic" | "browse">("library");
  const [analysisLanguage, setAnalysisLanguage] = useState<"english" | "chinese" | "auto">("english");
  const [autoRetry, setAutoRetry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getProfile().then((p) => {
      setDefaultView(p.default_view);
      setAnalysisLanguage(p.analysis_language);
      setAutoRetry(p.auto_retry);
      setLoaded(true);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ default_view: defaultView, analysis_language: analysisLanguage, auto_retry: autoRetry });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <div className="text-sm text-gray-400">Loading…</div>;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-5">Preferences</h2>
      <div className="flex flex-col gap-5 max-w-lg">
        {/* Default view */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-gray-700">Default view</span>
          <div className="flex gap-3">
            {(["library", "topic", "browse"] as const).map((v) => (
              <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="defaultView"
                  value={v}
                  checked={defaultView === v}
                  onChange={() => setDefaultView(v)}
                  className="accent-blue-600"
                />
                <span className="text-sm text-gray-700 capitalize">{v === "browse" ? "Browse" : v === "topic" ? "Topic Study" : "Library"}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Analysis language */}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Analysis language</span>
          <select
            value={analysisLanguage}
            onChange={(e) => setAnalysisLanguage(e.target.value as "english" | "chinese" | "auto")}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 max-w-xs"
          >
            <option value="english">English</option>
            <option value="chinese">中文</option>
            <option value="auto">Follow paper language</option>
          </select>
        </label>

        {/* Auto-retry */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setAutoRetry((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition ${autoRetry ? "bg-blue-600" : "bg-gray-300"}`}
          >
            <div className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${autoRetry ? "translate-x-5" : ""}`} />
          </div>
          <span className="text-sm text-gray-700">Auto-retry failed analyses</span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="self-start rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {saved ? "Saved ✓" : saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally
git add frontend/components/settings/AppPreferencesSection.tsx
git commit -m "feat: implement AppPreferencesSection with default view / language / auto-retry"
```

---

## Task 10: ConnectionTestPanel Component

**Files:**
- Create: `frontend/components/settings/ConnectionTestPanel.tsx`

- [ ] **Step 1: Write ConnectionTestPanel**

```typescript
// frontend/components/settings/ConnectionTestPanel.tsx
"use client";

import type { TestResult } from "@/lib/types";

interface Props {
  result: TestResult | null;
  testing: boolean;
}

const STATUS_SUGGESTIONS: Record<string, string> = {
  "401": "Check API Key for typos or expiry",
  "404": "Check Base URL — endpoint may have changed",
  "429": "Rate limited — your API quota may be exhausted",
  "network": "Cannot reach the endpoint — check Base URL or network",
};

function getSuggestion(error: string | null): string | null {
  if (!error) return null;
  if (error.includes("401")) return STATUS_SUGGESTIONS["401"];
  if (error.includes("404")) return STATUS_SUGGESTIONS["404"];
  if (error.includes("429")) return STATUS_SUGGESTIONS["429"];
  if (error.toLowerCase().includes("network") || error.toLowerCase().includes("cannot reach"))
    return STATUS_SUGGESTIONS["network"];
  return null;
}

export default function ConnectionTestPanel({ result, testing }: Props) {
  if (testing) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <span className="text-sm text-gray-600">Testing connection…</span>
      </div>
    );
  }

  if (!result) return null;

  if (result.status === "ok") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-green-600 font-semibold text-sm">✓ Connection successful</span>
          {result.latency_ms != null && (
            <span className="text-xs text-green-500">{result.latency_ms} ms</span>
          )}
        </div>
        {result.model && (
          <p className="text-xs text-green-600 mt-1">
            Model: {result.model} · Provider: {result.provider}
          </p>
        )}
      </div>
    );
  }

  const suggestion = getSuggestion(result.error);
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <p className="text-sm font-semibold text-red-600">✗ Connection failed</p>
      {result.error && <p className="text-xs text-red-500 mt-1">{result.error}</p>}
      {suggestion && (
        <p className="text-xs text-red-400 mt-1 italic">{suggestion}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally
git add frontend/components/settings/ConnectionTestPanel.tsx
git commit -m "feat: implement ConnectionTestPanel with spinner and success/error states"
```

---

## Task 11: ProviderPresetCard Component

**Files:**
- Create: `frontend/components/settings/ProviderPresetCard.tsx`

- [ ] **Step 1: Write ProviderPresetCard**

```typescript
// frontend/components/settings/ProviderPresetCard.tsx
"use client";

import type { ProviderPreset, ModelConfigOut } from "@/lib/types";

const PRESET_ICONS: Record<string, string> = {
  anthropic: "🤖",
  glm: "🧠",
  openai: "⚡",
  deepseek: "🔍",
  ollama: "🦙",
  custom: "⚙",
};

interface Props {
  preset: ProviderPreset;
  currentConfig: ModelConfigOut | null;
  onSelect: (preset: ProviderPreset) => void;
}

export default function ProviderPresetCard({ preset, currentConfig, onSelect }: Props) {
  const isActive = currentConfig?.preset === preset.id;
  const isConfigured =
    preset.id === "anthropic"
      ? !!currentConfig?.anthropic_api_key_hint
      : !!currentConfig?.vlm_api_key_hint && currentConfig?.preset === preset.id;

  return (
    <button
      onClick={() => onSelect(preset)}
      className={`flex flex-col gap-2 rounded-lg border p-3 text-left transition hover:shadow-sm ${
        isActive
          ? "border-blue-500 ring-2 ring-blue-500 bg-blue-50"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{PRESET_ICONS[preset.id] ?? "🔧"}</span>
        <span className="text-sm font-medium text-gray-800">{preset.label}</span>
      </div>
      <span
        className={`self-start rounded-full px-2 py-0.5 text-[10px] font-medium ${
          isActive
            ? "bg-blue-100 text-blue-700"
            : isConfigured
            ? "bg-green-100 text-green-700"
            : "bg-gray-100 text-gray-500"
        }`}
      >
        {isActive ? "Active" : isConfigured ? "Configured" : "Not configured"}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally
git add frontend/components/settings/ProviderPresetCard.tsx
git commit -m "feat: implement ProviderPresetCard with active ring and status badge"
```

---

## Task 12: ModelConfigSection Component

**Files:**
- Modify: `frontend/components/settings/ModelConfigSection.tsx` (replace stub)

- [ ] **Step 1: Write ModelConfigSection**

```typescript
// frontend/components/settings/ModelConfigSection.tsx
"use client";

import { useEffect, useState } from "react";
import { getModelConfig, updateModelConfig, testModelConnection, getModelPresets } from "@/lib/api";
import type { ModelConfigOut, ModelConfigIn, ProviderPreset, TestResult } from "@/lib/types";
import ProviderPresetCard from "./ProviderPresetCard";
import ConnectionTestPanel from "./ConnectionTestPanel";

function ConfigStatusBar({ config }: { config: ModelConfigOut }) {
  if (config.config_source === "database" && config.effective_model) {
    const preset = config.preset ?? config.effective_provider;
    const testedAt = config.last_tested_at
      ? new Date(config.last_tested_at).toLocaleString()
      : null;
    const statusColor =
      config.last_test_status === "ok"
        ? "text-green-600"
        : config.last_test_status === "failed"
        ? "text-red-600"
        : "text-gray-500";
    return (
      <div className={`flex items-center gap-2 text-xs ${statusColor}`}>
        <span>{config.last_test_status === "ok" ? "🟢" : config.last_test_status === "failed" ? "🔴" : "⚪"}</span>
        <span>Using DB config — {preset} ({config.effective_model})</span>
        {testedAt && <span className="text-gray-400">· Last tested: {testedAt}</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs text-yellow-600">
      <span>⚠️</span>
      <span>No DB config — Falling back to environment variables ({config.effective_provider} / {config.effective_model})</span>
    </div>
  );
}

export default function ModelConfigSection() {
  const [config, setConfig] = useState<ModelConfigOut | null>(null);
  const [presets, setPresets] = useState<ProviderPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<ProviderPreset | null>(null);

  // Form state
  const [apiKey, setApiKey] = useState("");
  const [apiKeyRevealed, setApiKeyRevealed] = useState(false);
  const [apiKeyEditing, setApiKeyEditing] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [visionModel, setVisionModel] = useState("");
  const [textModel, setTextModel] = useState("");
  const [sameModel, setSameModel] = useState(true);

  // UI state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getModelConfig(), getModelPresets()]).then(([cfg, prs]) => {
      setConfig(cfg);
      setPresets(prs);
      if (cfg.preset) {
        const p = prs.find((pr) => pr.id === cfg.preset) ?? null;
        setSelectedPreset(p);
      }
      setBaseUrl(cfg.vlm_base_url ?? "");
      setVisionModel(cfg.vlm_model ?? "");
      const hasSeparateText = !!cfg.vlm_text_model && cfg.vlm_text_model !== cfg.vlm_model;
      setSameModel(!hasSeparateText);
      setTextModel(cfg.vlm_text_model ?? "");
    });
  }, []);

  const handlePresetSelect = (preset: ProviderPreset) => {
    setSelectedPreset(preset);
    if (preset.base_url) setBaseUrl(preset.base_url);
    if (preset.vision_models.length > 0) setVisionModel(preset.vision_models[0]);
    if (preset.text_models.length > 0) setTextModel(preset.text_models[0]);
    setTestResult(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: ModelConfigIn = {
        preset: selectedPreset?.id,
        provider: selectedPreset?.provider,
        vlm_base_url: baseUrl || undefined,
        vlm_model: visionModel || undefined,
        vlm_text_model: sameModel ? null : (textModel || null),
      };
      if (apiKeyEditing && apiKey) {
        if (selectedPreset?.provider === "anthropic") {
          body.anthropic_api_key = apiKey;
        } else {
          body.vlm_api_key = apiKey;
        }
      }
      const updated = await updateModelConfig(body);
      setConfig(updated);
      setApiKey("");
      setApiKeyEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testModelConnection();
      setTestResult(result);
      // Refresh config to get updated last_tested_at
      const updated = await getModelConfig();
      setConfig(updated);
    } finally {
      setTesting(false);
    }
  };

  if (!config) return <div className="text-sm text-gray-400">Loading…</div>;

  const isAnthropic = selectedPreset?.provider === "anthropic";
  const keyHint = isAnthropic ? config.anthropic_api_key_hint : config.vlm_api_key_hint;
  const currentPresetModels = selectedPreset ?? { vision_models: [], text_models: [] };

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Status bar */}
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
        <ConfigStatusBar config={config} />
      </div>

      {/* 2. Provider preset grid */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Provider</h2>
        <div className="grid grid-cols-3 gap-3">
          {presets.map((p) => (
            <ProviderPresetCard
              key={p.id}
              preset={p}
              currentConfig={config}
              onSelect={handlePresetSelect}
            />
          ))}
        </div>
      </div>

      {/* 3. Config form */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Configuration</h2>
        <div className="flex flex-col gap-4 max-w-lg">
          {/* API Key */}
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">
              {isAnthropic ? "Anthropic API Key" : "API Key"}
            </span>
            {apiKeyEditing ? (
              <div className="flex gap-2">
                <input
                  type={apiKeyRevealed ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Paste new key…"
                />
                <button
                  onClick={() => setApiKeyRevealed((v) => !v)}
                  className="text-xs text-gray-500 hover:text-gray-800 px-2"
                  title={apiKeyRevealed ? "Hide" : "Reveal"}
                >
                  {apiKeyRevealed ? "👁‍🗨" : "👁"}
                </button>
                <button
                  onClick={() => { setApiKeyEditing(false); setApiKey(""); }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-gray-600 bg-gray-50 rounded border border-gray-200 px-3 py-2 flex-1">
                  {keyHint ?? <span className="text-gray-400 italic">Not set</span>}
                </span>
                <button
                  onClick={() => setApiKeyEditing(true)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  ✏ Edit
                </button>
              </div>
            )}
            <p className="text-xs text-gray-400">
              {config.config_source === "database"
                ? "From database"
                : "From environment variable — DB config will take priority if set"}
            </p>
          </div>

          {/* Base URL (hidden for Anthropic) */}
          {!isAnthropic && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Base URL</span>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="https://api.example.com/v1"
              />
            </label>
          )}

          {/* Vision model */}
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">
              Vision model
              <span className="ml-1 text-xs text-gray-400">(arch & eval figure analysis)</span>
            </span>
            {currentPresetModels.vision_models.length > 0 ? (
              <select
                value={visionModel}
                onChange={(e) => setVisionModel(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                {currentPresetModels.vision_models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={visionModel}
                onChange={(e) => setVisionModel(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="model-name"
              />
            )}
          </div>

          {/* Text model */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sameModel}
                onChange={(e) => setSameModel(e.target.checked)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">
                Use same model for text analysis
                <span className="ml-1 text-xs text-gray-400">(abstract analysis & Writing Coach)</span>
              </span>
            </label>
            {!sameModel && (
              currentPresetModels.text_models.length > 0 ? (
                <select
                  value={textModel}
                  onChange={(e) => setTextModel(e.target.value)}
                  className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  {currentPresetModels.text_models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={textModel}
                  onChange={(e) => setTextModel(e.target.value)}
                  className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="text-model-name"
                />
              )
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Save + Test buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {saved ? "Saved ✓" : saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={handleTest}
              disabled={testing || saving}
              className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              ▶ Test Connection
            </button>
          </div>

          {/* Test result panel */}
          <ConnectionTestPanel result={testResult} testing={testing} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally
git add frontend/components/settings/ModelConfigSection.tsx
git commit -m "feat: implement ModelConfigSection with status bar, preset cards, and config form"
```

---

## Task 13: Add ⚙ Icon to Main Page Header

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Add the gear icon link**

In `frontend/app/page.tsx`, modify the header to add the gear icon:

```typescript
// Change:
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import NavTabs from "@/components/layout/NavTabs";
import SearchBar from "@/components/layout/SearchBar";
import LibraryView from "@/components/library/LibraryView";
import TopicStudyView from "@/components/topic/TopicStudyView";
import BrowseByModuleView from "@/components/browse/BrowseByModuleView";

// To:
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import NavTabs from "@/components/layout/NavTabs";
import SearchBar from "@/components/layout/SearchBar";
import LibraryView from "@/components/library/LibraryView";
import TopicStudyView from "@/components/topic/TopicStudyView";
import BrowseByModuleView from "@/components/browse/BrowseByModuleView";
```

And change the header element from:
```typescript
      <header className="border-b bg-white px-6 py-4">
        <h1 className="text-xl font-semibold">AcademyGally</h1>
        <div className="mt-3 flex items-center gap-4">
          <NavTabs active={view} />
          <SearchBar />
        </div>
      </header>
```

To:
```typescript
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">AcademyGally</h1>
          <Link
            href="/settings"
            className="text-gray-400 hover:text-gray-700 text-lg"
            title="Settings"
          >
            ⚙
          </Link>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <NavTabs active={view} />
          <SearchBar />
        </div>
      </header>
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally
git add frontend/app/page.tsx
git commit -m "feat: add gear icon link to settings page in main header"
```

---

## Task 14: End-to-End Verification

- [ ] **Step 1: Start the backend**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally/backend
uvicorn main:app --reload --port 8000
```

- [ ] **Step 2: Verify all settings endpoints respond**

```bash
# In a new terminal:
curl -s http://localhost:8000/settings/profile | python3 -m json.tool
curl -s http://localhost:8000/settings/model | python3 -m json.tool
curl -s http://localhost:8000/settings/model/presets | python3 -m json.tool | head -20
```

Expected:
- `/settings/profile` → JSON with `default_view: "library"`, `auto_retry: false`
- `/settings/model` → JSON with `config_source: "environment"` (no DB row yet), `effective_provider` set
- `/settings/model/presets` → array of 6 objects with ids: anthropic, glm, openai, deepseek, ollama, custom

- [ ] **Step 3: Test profile save**

```bash
curl -s -X PUT http://localhost:8000/settings/profile \
  -H "Content-Type: application/json" \
  -d '{"display_name": "Test User", "institution": "MIT"}' | python3 -m json.tool
```

Expected: response with `display_name: "Test User"`, `institution: "MIT"`

- [ ] **Step 4: Verify GET returns saved values**

```bash
curl -s http://localhost:8000/settings/profile | python3 -m json.tool
```

Expected: same `display_name: "Test User"` persisted

- [ ] **Step 5: Test API key masking**

```bash
curl -s -X PUT http://localhost:8000/settings/model \
  -H "Content-Type: application/json" \
  -d '{"preset": "glm", "provider": "openai_compatible", "vlm_api_key": "sk-testkey1234", "vlm_model": "glm-4v-plus", "vlm_base_url": "https://open.bigmodel.cn/api/paas/v4/"}' \
  | python3 -m json.tool
```

Expected: `vlm_api_key_hint: "••••1234"` — full key never returned

- [ ] **Step 6: Start the frontend and navigate**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally/frontend
npm run dev
```

Open `http://localhost:3000` → verify ⚙ icon in top-right header.
Click ⚙ → navigates to `/settings`.
Verify 3-section sidebar renders: Profile / Model Config / Preferences.

- [ ] **Step 7: Final commit if everything works**

```bash
cd /Users/liqingwen/workplace/kw_project/AcademyGally
git add -A
git commit -m "feat: settings page end-to-end verification complete"
```

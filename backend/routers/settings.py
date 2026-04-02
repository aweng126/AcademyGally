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
    fields = body.model_fields_set
    if "preset" in fields:
        row.preset = body.preset
    if "provider" in fields:
        row.provider = body.provider
    if "anthropic_api_key" in fields:
        row.anthropic_api_key = body.anthropic_api_key if body.anthropic_api_key else None
    if "vlm_api_key" in fields:
        row.vlm_api_key = body.vlm_api_key if body.vlm_api_key else None
    if "vlm_base_url" in fields:
        row.vlm_base_url = body.vlm_base_url if body.vlm_base_url else None
    if "vlm_model" in fields:
        row.vlm_model = body.vlm_model if body.vlm_model else None
    if "vlm_text_model" in fields:
        row.vlm_text_model = body.vlm_text_model  # can be None (explicit clear)
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
        if "401" in error_msg:
            error_msg = "401 Unauthorized — Check API Key for typos or expiry"
        elif "404" in error_msg:
            error_msg = "404 Not Found — Check Base URL, endpoint may have changed"
        elif "429" in error_msg:
            error_msg = "429 Rate Limited — Your API quota may be exhausted"
        elif "Name or service not known" in error_msg or "Connection refused" in error_msg or "Failed to establish" in error_msg:
            error_msg = "Cannot reach the endpoint — check Base URL or network"
        else:
            error_msg = "Unexpected error — check your configuration and try again"
        logger.warning("Model connection test failed: %s", e)
        return TestResult(status="failed", latency_ms=latency_ms, model=model, provider=provider, error=error_msg)


@router.get("/model/presets")
def get_model_presets() -> list[ProviderPreset]:
    return [ProviderPreset(**p) for p in _PRESETS]

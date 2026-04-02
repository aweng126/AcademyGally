"""
VLM analysis service — supports two providers:

  VLM_PROVIDER=anthropic          (default)
      Uses the Anthropic SDK directly.
      Required env vars: ANTHROPIC_API_KEY
      Optional: VLM_MODEL (default: claude-opus-4-6)

  VLM_PROVIDER=openai_compatible
      Uses the OpenAI SDK with a configurable base URL.
      Works with: GLM (智谱AI), OpenAI, DeepSeek, Ollama, and any OpenAI-
      compatible API endpoint.
      Required env vars: VLM_API_KEY, VLM_BASE_URL, VLM_MODEL
      Optional: VLM_TEXT_MODEL (model for text-only calls, defaults to VLM_MODEL)

Example .env for GLM:
    VLM_PROVIDER=openai_compatible
    VLM_API_KEY=<your zhipuai key>
    VLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4/
    VLM_MODEL=glm-4v-plus
    VLM_TEXT_MODEL=glm-4-plus

Example .env for OpenAI:
    VLM_PROVIDER=openai_compatible
    VLM_API_KEY=<your openai key>
    VLM_BASE_URL=https://api.openai.com/v1
    VLM_MODEL=gpt-4o
"""
import json
import base64
import logging
import re
import os
from pathlib import Path

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

_EXT_TO_MEDIA_TYPE = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "webp": "image/webp",
    "bmp": "image/png",
}

# ---------------------------------------------------------------------------
# Provider helpers
# ---------------------------------------------------------------------------

def _provider() -> str:
    return get_effective_vlm_config()["provider"]


def _vlm_model() -> str:
    return get_effective_vlm_config()["vlm_model"]


def _vlm_text_model() -> str:
    cfg = get_effective_vlm_config()
    return cfg["vlm_text_model"] or cfg["vlm_model"]


# Lazy singletons
_anthropic_client = None
_openai_client = None


# ---------------------------------------------------------------------------
# Effective config — DB first, env fallback
# ---------------------------------------------------------------------------

def get_effective_vlm_config(db=None) -> dict:
    """
    Returns the effective VLM configuration as a plain dict.
    Priority: DB model_config row (user_id=1) → environment variables → built-in defaults.
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

    env_provider = os.getenv("VLM_PROVIDER", "anthropic").lower()
    return {
        "provider": env_provider,
        "vlm_model": os.getenv("VLM_MODEL", "claude-opus-4-6") if env_provider == "anthropic" else os.getenv("VLM_MODEL", "glm-4v-plus"),
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


def _get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None:
        import anthropic
        cfg = get_effective_vlm_config()
        _anthropic_client = anthropic.Anthropic(api_key=cfg["anthropic_api_key"] or None)
    return _anthropic_client


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


# ---------------------------------------------------------------------------
# Shared utilities
# ---------------------------------------------------------------------------

def load_prompt(module_type: str) -> str:
    return (PROMPTS_DIR / f"{module_type}.txt").read_text()


def _strip_fences(text: str) -> str:
    """Remove markdown code fences the model may add despite instructions."""
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    return re.sub(r"\s*```$", "", text)


def _parse_json(text: str) -> dict:
    return json.loads(_strip_fences(text))


# ---------------------------------------------------------------------------
# Provider implementations
# ---------------------------------------------------------------------------

def _anthropic_image(image_data: str, media_type: str, prompt: str) -> str:
    import anthropic
    response = _get_anthropic_client().messages.create(
        model=_vlm_model(),
        max_tokens=2048,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_data,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )
    return response.content[0].text


def _anthropic_text(user_message: str) -> str:
    response = _get_anthropic_client().messages.create(
        model=_vlm_text_model(),
        max_tokens=2048,
        messages=[{"role": "user", "content": user_message}],
    )
    return response.content[0].text


def _openai_image(image_data: str, media_type: str, prompt: str) -> str:
    response = _get_openai_client().chat.completions.create(
        model=_vlm_model(),
        max_tokens=2048,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{media_type};base64,{image_data}"},
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )
    return response.choices[0].message.content


def _openai_text(user_message: str) -> str:
    response = _get_openai_client().chat.completions.create(
        model=_vlm_text_model(),
        max_tokens=2048,
        messages=[{"role": "user", "content": user_message}],
    )
    return response.choices[0].message.content


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyze_image(image_path: str, module_type: str) -> dict:
    """
    Send an image + module-specific prompt to the configured VLM provider.
    Returns parsed analysis_json dict. Retries once on failure.
    """
    figures_dir = os.getenv("FIGURES_DIR", "./data/figures")
    full_path = Path(figures_dir) / image_path

    with open(full_path, "rb") as f:
        raw = f.read()

    ext = full_path.suffix.lstrip(".").lower()
    media_type = _EXT_TO_MEDIA_TYPE.get(ext, "image/png")
    image_data = base64.standard_b64encode(raw).decode("utf-8")
    prompt = load_prompt(module_type)
    provider = _provider()

    last_err: Exception | None = None
    for attempt in range(2):
        try:
            if provider == "anthropic":
                raw_text = _anthropic_image(image_data, media_type, prompt)
            else:
                raw_text = _openai_image(image_data, media_type, prompt)
            return _parse_json(raw_text)
        except Exception as e:
            last_err = e
            logger.warning("Image analysis attempt %d failed: %s", attempt + 1, e)

    raise RuntimeError(f"VLM image analysis failed after retries: {last_err}")


def analyze_text(text: str, module_type: str) -> dict:
    """
    Send plain text + module-specific prompt to the configured VLM provider.
    Used for text-based modules such as 'abstract'. Retries once on failure.
    """
    prompt = load_prompt(module_type)
    user_message = f"{prompt}\n\nText to analyze:\n---\n{text}\n---"
    provider = _provider()

    last_err: Exception | None = None
    for attempt in range(2):
        try:
            if provider == "anthropic":
                raw_text = _anthropic_text(user_message)
            else:
                raw_text = _openai_text(user_message)
            return _parse_json(raw_text)
        except Exception as e:
            last_err = e
            logger.warning("Text analysis attempt %d failed: %s", attempt + 1, e)

    raise RuntimeError(f"VLM text analysis failed after retries: {last_err}")

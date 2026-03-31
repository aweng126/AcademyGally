import json
import base64
import re
import os
from pathlib import Path
import anthropic

_client: anthropic.Anthropic | None = None
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

_EXT_TO_MEDIA_TYPE = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "webp": "image/webp",
    "bmp": "image/png",
}


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def _get_model() -> str:
    return os.getenv("VLM_MODEL", "claude-opus-4-6")


def load_prompt(module_type: str) -> str:
    return (PROMPTS_DIR / f"{module_type}.txt").read_text()


def _strip_fences(text: str) -> str:
    """Remove markdown code fences the model may add despite instructions."""
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    return re.sub(r"\s*```$", "", text)


def analyze_image(image_path: str, module_type: str) -> dict:
    """
    Send an image + module-specific prompt to Claude Vision.
    Returns parsed analysis_json dict. Retries once on JSON parse failure.
    """
    figures_dir = os.getenv("FIGURES_DIR", "./data/figures")
    full_path = Path(figures_dir) / image_path

    with open(full_path, "rb") as f:
        raw = f.read()

    ext = full_path.suffix.lstrip(".").lower()
    media_type = _EXT_TO_MEDIA_TYPE.get(ext, "image/png")
    image_data = base64.standard_b64encode(raw).decode("utf-8")
    prompt = load_prompt(module_type)

    last_err: Exception | None = None
    for _ in range(2):
        try:
            response = _get_client().messages.create(
                model=_get_model(),
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
            return json.loads(_strip_fences(response.content[0].text))
        except Exception as e:
            last_err = e

    raise RuntimeError(f"VLM image analysis failed after retries: {last_err}")


def analyze_text(text: str, module_type: str) -> dict:
    """
    Send plain text + module-specific prompt to Claude (no vision).
    Used for text-based modules such as 'abstract'.
    Retries once on JSON parse failure.
    """
    prompt = load_prompt(module_type)
    user_message = f"{prompt}\n\nText to analyze:\n---\n{text}\n---"

    last_err: Exception | None = None
    for _ in range(2):
        try:
            response = _get_client().messages.create(
                model=_get_model(),
                max_tokens=2048,
                messages=[{"role": "user", "content": user_message}],
            )
            return json.loads(_strip_fences(response.content[0].text))
        except Exception as e:
            last_err = e

    raise RuntimeError(f"VLM text analysis failed after retries: {last_err}")

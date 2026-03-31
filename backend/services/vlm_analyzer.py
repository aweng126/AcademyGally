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
    "bmp": "image/png",  # re-encode as png fallback
}


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def load_prompt(module_type: str) -> str:
    return (PROMPTS_DIR / f"{module_type}.txt").read_text()


def analyze_image(image_path: str, module_type: str) -> dict:
    """
    Send image + module-specific prompt to Claude Vision.
    Returns parsed analysis_json dict.
    Retries once on JSON parse failure.
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

    for attempt in range(2):
        try:
            response = _get_client().messages.create(
                model="claude-opus-4-6",
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
            text = response.content[0].text.strip()
            # Strip markdown code fences the model may add despite instructions
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
            return json.loads(text)
        except Exception as e:
            last_err = e
            if attempt == 0:
                continue

    raise RuntimeError(f"VLM analysis failed after retries: {last_err}")

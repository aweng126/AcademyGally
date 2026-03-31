import json
from pathlib import Path
import anthropic

_client: anthropic.Anthropic | None = None
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def load_prompt(module_type: str) -> str:
    prompt_file = PROMPTS_DIR / f"{module_type}.txt"
    return prompt_file.read_text()


def analyze_image(image_path: str, module_type: str) -> dict:
    """
    Send image to Claude Vision with the appropriate prompt template.
    Returns parsed analysis_json dict.
    """
    # TODO: read image, encode to base64, call claude-opus-4-6 with vision
    raise NotImplementedError

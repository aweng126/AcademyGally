from .module_registry import ExtractedItem


def classify_figure(item: ExtractedItem) -> str:
    """
    Call VLM to classify an extracted image into:
      arch_figure | eval_figure | other
    Phase 1: returns 'other' by default; human confirmation via UI.
    """
    # TODO: implement VLM-based classification
    return "other"

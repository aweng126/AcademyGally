from .module_registry import BaseExtractor, ExtractedItem
from .vlm_analyzer import analyze_image as _analyze_image


class EvalFigureExtractor(BaseExtractor):
    module_type = "eval_figure"

    def extract(self, pdf_path: str) -> list[ExtractedItem]:
        # Images are extracted by pdf_extractor; human confirmation assigns module_type.
        raise NotImplementedError("Use pdf_extractor.extract_images_from_pdf in the pipeline")

    def analyze(self, item: ExtractedItem) -> dict:
        return _analyze_image(item.image_path, self.module_type)

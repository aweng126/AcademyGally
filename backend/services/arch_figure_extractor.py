from .module_registry import BaseExtractor, ExtractedItem
from .pdf_extractor import extract_images_from_pdf
from .vlm_analyzer import analyze_image as _analyze_image


class ArchFigureExtractor(BaseExtractor):
    module_type = "arch_figure"

    def extract(self, pdf_path: str) -> list[ExtractedItem]:
        # The pipeline calls pdf_extractor.extract_images_from_pdf directly;
        # human confirmation then assigns module_type before analyze() is called.
        raise NotImplementedError("Use pdf_extractor.extract_images_from_pdf in the pipeline")

    def analyze(self, item: ExtractedItem) -> dict:
        return _analyze_image(item.image_path, self.module_type)

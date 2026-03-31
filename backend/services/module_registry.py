from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class ExtractedItem:
    image_path: str | None
    page_number: int | None
    caption: str | None
    raw_data: Any = None


class BaseExtractor(ABC):
    module_type: str

    @abstractmethod
    def extract(self, pdf_path: str) -> list[ExtractedItem]:
        """Locate and extract raw content from PDF."""
        ...

    @abstractmethod
    def analyze(self, item: ExtractedItem) -> dict:
        """Call VLM, return analysis_json matching the module schema."""
        ...


class ModuleRegistry:
    def __init__(self):
        self._registry: dict[str, BaseExtractor] = {}

    def register(self, extractor: BaseExtractor) -> None:
        self._registry[extractor.module_type] = extractor

    def get(self, module_type: str) -> BaseExtractor:
        if module_type not in self._registry:
            raise KeyError(f"No extractor registered for module_type={module_type!r}")
        return self._registry[module_type]

    def registered_types(self) -> list[str]:
        return list(self._registry.keys())


registry = ModuleRegistry()

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

from database import Base
from routers import papers, content, topics, writing_coach, settings
from services.arch_figure_extractor import ArchFigureExtractor
from services.abstract_extractor import AbstractExtractor
from services.eval_figure_extractor import EvalFigureExtractor
from services.algorithm_extractor import AlgorithmExtractor
from services.module_registry import registry

# Register module extractors
registry.register(ArchFigureExtractor())
registry.register(AbstractExtractor())
registry.register(EvalFigureExtractor())
registry.register(AlgorithmExtractor())

app = FastAPI(title="AcademyGally API", version="0.1.0")

_cors_origins_env = os.getenv("CORS_ORIGINS", "")
_cors_origins = (
    [o.strip() for o in _cors_origins_env.split(",") if o.strip()]
    if _cors_origins_env
    else ["http://localhost:3000", "http://127.0.0.1:3000"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

figures_dir = os.getenv("FIGURES_DIR", "./data/figures")
os.makedirs(figures_dir, exist_ok=True)
app.mount("/figures", StaticFiles(directory=figures_dir), name="figures")

app.include_router(papers.router, prefix="/papers", tags=["papers"])
app.include_router(content.router, prefix="/content", tags=["content"])
app.include_router(topics.router, prefix="/topics", tags=["topics"])
app.include_router(writing_coach.router, prefix="/writing-coach", tags=["writing_coach"])
app.include_router(settings.router, prefix="/settings", tags=["settings"])


@app.get("/health")
def health():
    return {"status": "ok"}

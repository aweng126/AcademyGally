from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from database import Base, engine
from routers import papers, content, topics

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AcademyGally API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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


@app.get("/health")
def health():
    return {"status": "ok"}

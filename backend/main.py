"""FastAPI entry point for the multi-AI voice agent."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import config, maps, orchestrator


app = FastAPI(title="Multi-AI Voice Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    model: Literal["auto", "claude", "chatgpt", "kimi"] = "auto"
    history: list[Message] = []


class ChatResponse(BaseModel):
    reply: str
    model: str
    history: list[Message]


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "providers": {
            "claude": bool(config.ANTHROPIC_API_KEY),
            "chatgpt": bool(config.OPENAI_API_KEY),
            "kimi": bool(config.MOONSHOT_API_KEY),
            "google_maps": bool(config.GOOGLE_MAPS_API_KEY),
        },
    }


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    try:
        history_dicts = [m.model_dump() for m in req.history]
        if req.model == "auto":
            reply, new_history = orchestrator.orchestrate(history_dicts, req.message)
        else:
            reply = orchestrator.direct_ask(req.model, req.message)
            new_history = history_dicts + [
                {"role": "user", "content": req.message},
                {"role": "assistant", "content": reply},
            ]
        return ChatResponse(
            reply=reply,
            model=req.model,
            history=[Message(**m) for m in new_history],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class PlacesRequest(BaseModel):
    query: str
    location: str | None = None


@app.post("/api/maps/places")
def api_places(req: PlacesRequest) -> dict[str, Any]:
    try:
        return maps.search_places(req.query, req.location)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class DirectionsRequest(BaseModel):
    origin: str
    destination: str
    mode: Literal["driving", "walking", "bicycling", "transit"] = "driving"


@app.post("/api/maps/directions")
def api_directions(req: DirectionsRequest) -> dict[str, Any]:
    try:
        return maps.directions(req.origin, req.destination, req.mode)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class GeocodeRequest(BaseModel):
    address: str


@app.post("/api/maps/geocode")
def api_geocode(req: GeocodeRequest) -> dict[str, Any]:
    try:
        return maps.geocode(req.address)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Static frontend
_FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
if _FRONTEND.exists():
    app.mount("/static", StaticFiles(directory=str(_FRONTEND)), name="static")

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(str(_FRONTEND / "index.html"))


def run() -> None:
    import uvicorn

    uvicorn.run("backend.main:app", host=config.HOST, port=config.PORT, reload=False)


if __name__ == "__main__":
    run()

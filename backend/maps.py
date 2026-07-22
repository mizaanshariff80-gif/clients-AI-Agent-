"""Thin wrappers around Google Maps Platform REST APIs."""
from __future__ import annotations

from typing import Any, Optional

import httpx

from . import config


_BASE = "https://maps.googleapis.com/maps/api"


def _require_key() -> str:
    if not config.GOOGLE_MAPS_API_KEY:
        raise RuntimeError("GOOGLE_MAPS_API_KEY not set")
    return config.GOOGLE_MAPS_API_KEY


def geocode(address: str) -> dict[str, Any]:
    """Convert an address to lat/lng + formatted address."""
    r = httpx.get(
        f"{_BASE}/geocode/json",
        params={"address": address, "key": _require_key()},
        timeout=15.0,
    )
    r.raise_for_status()
    data = r.json()
    results = data.get("results", [])
    if not results:
        return {"status": data.get("status", "ZERO_RESULTS"), "results": []}
    top = results[0]
    loc = top["geometry"]["location"]
    return {
        "status": "OK",
        "formatted_address": top["formatted_address"],
        "location": loc,
        "place_id": top.get("place_id"),
    }


def search_places(query: str, location: Optional[str] = None) -> dict[str, Any]:
    """Text search for places. `location` is a free-form area, e.g. 'Bengaluru'."""
    q = query
    if location:
        q = f"{query} in {location}"
    r = httpx.get(
        f"{_BASE}/place/textsearch/json",
        params={"query": q, "key": _require_key()},
        timeout=20.0,
    )
    r.raise_for_status()
    data = r.json()
    results = []
    for p in data.get("results", [])[:8]:
        results.append(
            {
                "name": p.get("name"),
                "address": p.get("formatted_address"),
                "rating": p.get("rating"),
                "user_ratings_total": p.get("user_ratings_total"),
                "types": p.get("types", [])[:3],
                "location": p.get("geometry", {}).get("location"),
                "place_id": p.get("place_id"),
            }
        )
    return {"status": data.get("status", "OK"), "results": results}


def directions(
    origin: str,
    destination: str,
    mode: str = "driving",
) -> dict[str, Any]:
    """Get route directions. mode = driving | walking | bicycling | transit."""
    r = httpx.get(
        f"{_BASE}/directions/json",
        params={
            "origin": origin,
            "destination": destination,
            "mode": mode,
            "key": _require_key(),
        },
        timeout=20.0,
    )
    r.raise_for_status()
    data = r.json()
    routes = data.get("routes", [])
    if not routes:
        return {"status": data.get("status", "ZERO_RESULTS")}
    leg = routes[0]["legs"][0]
    steps = []
    for s in leg.get("steps", [])[:15]:
        # Google returns HTML instructions; strip tags naively for voice.
        instr = s.get("html_instructions", "")
        for tag in ("<b>", "</b>", "<div>", "</div>", "<br>", "<br/>"):
            instr = instr.replace(tag, " ")
        steps.append(
            {
                "instruction": " ".join(instr.split()),
                "distance": s.get("distance", {}).get("text"),
                "duration": s.get("duration", {}).get("text"),
            }
        )
    return {
        "status": "OK",
        "summary": routes[0].get("summary"),
        "distance": leg.get("distance", {}).get("text"),
        "duration": leg.get("duration", {}).get("text"),
        "start_address": leg.get("start_address"),
        "end_address": leg.get("end_address"),
        "steps": steps,
    }

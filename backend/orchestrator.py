"""Claude-based orchestrator that can call other models and Google Maps as tools."""
from __future__ import annotations

import json
from typing import Any

from . import config, maps, providers


TOOLS = [
    {
        "name": "ask_chatgpt",
        "description": (
            "Ask OpenAI's ChatGPT a question and return its answer. "
            "Use when the user explicitly asks for ChatGPT's opinion, "
            "or when a second perspective from ChatGPT is useful."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "The question or prompt to send to ChatGPT."}
            },
            "required": ["prompt"],
        },
    },
    {
        "name": "ask_kimi",
        "description": (
            "Ask Moonshot's Kimi model a question and return its answer. "
            "Use when the user asks for Kimi's opinion, wants a Chinese-language "
            "perspective, or wants to compare with Kimi."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "The question or prompt to send to Kimi."}
            },
            "required": ["prompt"],
        },
    },
    {
        "name": "search_places",
        "description": "Search Google Maps for places (restaurants, shops, landmarks, etc.).",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "What to search for, e.g. 'coffee shops'."},
                "location": {
                    "type": "string",
                    "description": "Optional area to bias the search, e.g. 'Bengaluru' or 'near Times Square'.",
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_directions",
        "description": "Get turn-by-turn directions between two locations from Google Maps.",
        "input_schema": {
            "type": "object",
            "properties": {
                "origin": {"type": "string", "description": "Starting address or place name."},
                "destination": {"type": "string", "description": "Destination address or place name."},
                "mode": {
                    "type": "string",
                    "enum": ["driving", "walking", "bicycling", "transit"],
                    "description": "Travel mode. Defaults to driving.",
                },
            },
            "required": ["origin", "destination"],
        },
    },
    {
        "name": "geocode_address",
        "description": "Convert an address or place name to latitude/longitude using Google Maps.",
        "input_schema": {
            "type": "object",
            "properties": {
                "address": {"type": "string", "description": "Address or place name to geocode."}
            },
            "required": ["address"],
        },
    },
]


SYSTEM_PROMPT = (
    "You are a friendly multi-AI voice assistant. The user is talking to you by voice, "
    "so keep replies short, conversational, and easy to speak aloud. Avoid markdown, "
    "long lists, or code blocks unless the user explicitly asks. "
    "You have tools to consult ChatGPT and Kimi, and to query Google Maps for places, "
    "directions, and geocoding. Use those tools when the user asks for them by name, "
    "or when they are clearly needed. Otherwise, answer directly as Claude."
)


def _run_tool(name: str, args: dict[str, Any]) -> str:
    try:
        if name == "ask_chatgpt":
            return providers.ask_chatgpt(args["prompt"])
        if name == "ask_kimi":
            return providers.ask_kimi(args["prompt"])
        if name == "search_places":
            return json.dumps(maps.search_places(args["query"], args.get("location")))
        if name == "get_directions":
            return json.dumps(
                maps.directions(
                    args["origin"],
                    args["destination"],
                    args.get("mode", "driving"),
                )
            )
        if name == "geocode_address":
            return json.dumps(maps.geocode(args["address"]))
        return f"Unknown tool: {name}"
    except Exception as e:
        return f"Tool {name} failed: {e}"


def orchestrate(history: list[dict[str, Any]], user_message: str) -> tuple[str, list[dict[str, Any]]]:
    """Run one user turn through Claude with tool-use.

    `history` is a list of {"role": "user"|"assistant", "content": str} messages.
    Returns (assistant_text, new_history).
    """
    client = providers.anthropic_client()
    messages: list[dict[str, Any]] = []
    for m in history:
        messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": user_message})

    # Tool-use loop, bounded.
    for _ in range(6):
        resp = client.messages.create(
            model=config.CLAUDE_MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        # Collect the assistant turn as-is so we can feed it back in.
        assistant_content = []
        text_parts: list[str] = []
        tool_uses = []
        for block in resp.content:
            btype = getattr(block, "type", None)
            if btype == "text":
                assistant_content.append({"type": "text", "text": block.text})
                text_parts.append(block.text)
            elif btype == "tool_use":
                assistant_content.append(
                    {
                        "type": "tool_use",
                        "id": block.id,
                        "name": block.name,
                        "input": block.input,
                    }
                )
                tool_uses.append(block)

        messages.append({"role": "assistant", "content": assistant_content})

        if resp.stop_reason != "tool_use" or not tool_uses:
            reply = "\n".join(t for t in text_parts if t).strip()
            new_history = history + [
                {"role": "user", "content": user_message},
                {"role": "assistant", "content": reply},
            ]
            return reply or "(no reply)", new_history

        tool_results = []
        for tu in tool_uses:
            result = _run_tool(tu.name, tu.input or {})
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": tu.id,
                    "content": result,
                }
            )
        messages.append({"role": "user", "content": tool_results})

    # Bail-out if the loop didn't terminate.
    fallback = "Sorry, I got stuck in a tool loop. Try rephrasing?"
    new_history = history + [
        {"role": "user", "content": user_message},
        {"role": "assistant", "content": fallback},
    ]
    return fallback, new_history


def direct_ask(model: str, prompt: str) -> str:
    """Send the prompt straight to a specific model, bypassing the orchestrator."""
    if model == "claude":
        return providers.ask_claude(prompt)
    if model == "chatgpt":
        return providers.ask_chatgpt(prompt)
    if model == "kimi":
        return providers.ask_kimi(prompt)
    raise ValueError(f"Unknown model: {model}")

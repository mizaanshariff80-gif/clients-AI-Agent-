"""Wrappers for the three chat providers: Claude, ChatGPT, Kimi."""
from __future__ import annotations

from typing import Optional

from anthropic import Anthropic
from openai import OpenAI

from . import config


_anthropic: Optional[Anthropic] = None
_openai: Optional[OpenAI] = None
_kimi: Optional[OpenAI] = None


def anthropic_client() -> Anthropic:
    global _anthropic
    if _anthropic is None:
        if not config.ANTHROPIC_API_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY not set")
        _anthropic = Anthropic(api_key=config.ANTHROPIC_API_KEY)
    return _anthropic


def openai_client() -> OpenAI:
    global _openai
    if _openai is None:
        if not config.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY not set")
        _openai = OpenAI(api_key=config.OPENAI_API_KEY)
    return _openai


def kimi_client() -> OpenAI:
    global _kimi
    if _kimi is None:
        if not config.MOONSHOT_API_KEY:
            raise RuntimeError("MOONSHOT_API_KEY not set")
        _kimi = OpenAI(
            api_key=config.MOONSHOT_API_KEY,
            base_url=config.MOONSHOT_BASE_URL,
        )
    return _kimi


def ask_chatgpt(prompt: str, system: str = "You are a helpful assistant.") -> str:
    """Send a single-turn prompt to ChatGPT and return the reply."""
    resp = openai_client().chat.completions.create(
        model=config.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
    )
    return (resp.choices[0].message.content or "").strip()


def ask_kimi(prompt: str, system: str = "You are Kimi, a helpful assistant.") -> str:
    """Send a single-turn prompt to Kimi (Moonshot) and return the reply."""
    resp = kimi_client().chat.completions.create(
        model=config.KIMI_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        temperature=0.6,
    )
    return (resp.choices[0].message.content or "").strip()


def ask_claude(prompt: str, system: str = "You are Claude, a helpful assistant.") -> str:
    """Single-turn to Claude (no tools)."""
    resp = anthropic_client().messages.create(
        model=config.CLAUDE_MODEL,
        max_tokens=1024,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    parts = []
    for block in resp.content:
        if getattr(block, "type", None) == "text":
            parts.append(block.text)
    return "".join(parts).strip()

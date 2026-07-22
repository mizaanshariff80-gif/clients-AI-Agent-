# Multi-AI Voice Agent

A voice-to-voice web agent that talks to **Claude**, **ChatGPT**, **Kimi (Moonshot)**, and **Google Maps** from a single browser tab.

- Push-to-talk (mouse, touch, or spacebar) in the browser using the Web Speech API.
- Replies are spoken back with the browser's speech synthesis — pick any installed voice.
- A **Claude-powered orchestrator** decides when to consult ChatGPT / Kimi / Google Maps as tools, so you can just say things like *"ask ChatGPT what it thinks about…"*, *"what does Kimi say about…"*, *"find sushi near Bengaluru"*, *"directions from MG Road to the airport"*.
- Or force a single model from the dropdown ("Claude only" / "ChatGPT only" / "Kimi only").

## Architecture

```
Browser (Web Speech API for STT + TTS)
        │  POST /api/chat  { message, model, history }
        ▼
FastAPI backend (backend/main.py)
        │
        └── orchestrator.py  ── Claude (tool-use)
                                    ├── ask_chatgpt      → OpenAI
                                    ├── ask_kimi         → Moonshot
                                    ├── search_places    ┐
                                    ├── get_directions   ├─ Google Maps Platform
                                    └── geocode_address  ┘
```

## Setup

1. Copy env and fill in your keys:
   ```bash
   cp .env.example .env
   # then edit .env
   ```
   Keys you need:
   - `ANTHROPIC_API_KEY` — https://console.anthropic.com/
   - `OPENAI_API_KEY` — https://platform.openai.com/api-keys
   - `MOONSHOT_API_KEY` — https://platform.moonshot.ai/ (international) or `.cn` (China)
   - `GOOGLE_MAPS_API_KEY` — Google Cloud Console, with **Places API**, **Directions API**, **Geocoding API** enabled.

2. Run it:
   ```bash
   ./run.sh
   ```
   Or manually:
   ```bash
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   python -m backend.main
   ```

3. Open http://localhost:8000 in **Chrome or Edge** (Safari also works, Firefox does not support the Web Speech API for input). Grant microphone permission when prompted.

## Using it

- **Hold the "Hold to talk" button** (or hold **space**) while you speak. Release to send.
- Or type in the text box.
- Pick a specific model from the **Model** dropdown, or leave it on **Auto** to let Claude orchestrate.
- Pick your preferred TTS voice in the **Voice** dropdown.

### Example utterances (Auto mode)

- "What's the weather like in Tokyo right now?" → Claude answers.
- "Ask ChatGPT for three startup name ideas for a coffee shop." → Claude calls `ask_chatgpt` and reads the answer.
- "What does Kimi say about the future of solar energy?" → Claude calls `ask_kimi`.
- "Find good ramen places in Bengaluru." → Claude calls `search_places`.
- "How do I get from Indiranagar to Kempegowda Airport by car?" → Claude calls `get_directions`.
- "Where exactly is the Louvre?" → Claude calls `geocode_address`.

## API

- `POST /api/chat` — `{ message, model: "auto"|"claude"|"chatgpt"|"kimi", history }`
- `POST /api/maps/places` — `{ query, location? }`
- `POST /api/maps/directions` — `{ origin, destination, mode? }`
- `POST /api/maps/geocode` — `{ address }`
- `GET  /api/health` — which providers have keys configured.

## Notes

- Voice input runs entirely in the browser — nothing is uploaded until the transcript is sent to `/api/chat`.
- If a provider's key isn't set, that tool/model just returns an error string; the rest keep working.
- Model IDs live in `.env` (`CLAUDE_MODEL`, `OPENAI_MODEL`, `KIMI_MODEL`) — swap them as new models ship.

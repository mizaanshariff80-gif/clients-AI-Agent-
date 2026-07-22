#!/usr/bin/env bash
# Convenience launcher.
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

pip install -q --upgrade pip
pip install -q -r requirements.txt

if [ ! -f .env ]; then
  echo ".env not found — copy .env.example to .env and fill in your API keys."
  exit 1
fi

exec python -m backend.main

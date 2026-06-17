#!/bin/bash
set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       Nexora AI System — Dev Mode        ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Create .env if missing
if [ ! -f server/.env ]; then
  echo "ERROR: server/.env not found."
  echo ""
  echo "Create it first:"
  echo "  echo 'ANTHROPIC_API_KEY=your_key_here' > server/.env"
  echo "  echo 'PORT=3001' >> server/.env"
  echo ""
  exit 1
fi

# Install server deps if missing
if [ ! -d server/node_modules ]; then
  echo "📦 Installing server dependencies..."
  (cd server && npm install --silent)
  echo "✓  Done"
fi

echo "🚀 Server  →  http://localhost:3001"
echo "   (serving built client from client/dist/)"
echo ""

cd server && node --watch index.js

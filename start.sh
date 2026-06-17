#!/bin/bash
set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║        Nexora AI System — Starting       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Create .env if missing
if [ ! -f server/.env ]; then
  echo "ERROR: server/.env not found."
  echo ""
  echo "Create it with:"
  echo "  echo 'ANTHROPIC_API_KEY=your_key_here' > server/.env"
  echo "  echo 'PORT=3001' >> server/.env"
  echo ""
  echo "Then run: npm start"
  exit 1
fi

# Install server dependencies if missing
if [ ! -d server/node_modules ]; then
  echo "📦 Installing server dependencies..."
  (cd server && npm install --silent)
  echo "✓  Dependencies installed"
fi

echo "🚀 Starting Nexora AI System..."
echo ""
echo "   ➜  Open your browser:  http://localhost:3001"
echo ""

cd server && node index.js

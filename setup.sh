#!/bin/bash
set -e

echo "🛡️  Sentinel Self-Host Setup (Linux/macOS)"
echo "==========================================="

# Check Python version
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.10+."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
if (( $(echo "$PYTHON_VERSION < 3.10" | bc -l) )); then
    echo "❌ Python version must be 3.10 or higher. Found: $PYTHON_VERSION"
    exit 1
fi
echo "✅ Python $PYTHON_VERSION detected."

# Check Node version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node 18+."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version must be 18 or higher. Found: $NODE_VERSION"
    exit 1
fi
echo "✅ Node.js v$NODE_VERSION detected."

# Set up Backend
echo "📦 Setting up backend..."
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "⚠️  Created backend/.env. Please update GROQ_API_KEY inside it."
fi
cd ..

# Set up Dashboard
echo "📦 Setting up dashboard..."
cd dashboard
npm install
cd ..

# Set up SDK
echo "📦 Setting up SDK..."
cd sdk
npm install
npm run build
cd ..

echo ""
echo "🎉 Setup Complete!"
echo "==========================================="
echo "To start the system:"
echo "1. Start Backend:   cd backend && source venv/bin/activate && uvicorn main:app --reload"
echo "2. Start Dashboard: cd dashboard && npm run dev"
echo "3. Register App:    curl -X POST http://localhost:8000/apps/register -H 'Content-Type: application/json' -d '{\"name\":\"My Test App\"}'"
echo "==========================================="

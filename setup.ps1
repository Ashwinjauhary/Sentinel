<#
.SYNOPSIS
Sentinel Self-Host Setup Script for Windows
#>

$ErrorActionPreference = "Stop"

Write-Host "🛡️  Sentinel Self-Host Setup (Windows)" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

# Check Python
$pythonCmd = if (Get-Command "python" -ErrorAction SilentlyContinue) { "python" } elseif (Get-Command "python3" -ErrorAction SilentlyContinue) { "python3" } else { $null }

if (-not $pythonCmd) {
    Write-Host "❌ Python is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

$pyVersion = & $pythonCmd -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
if ([double]$pyVersion -lt 3.10) {
    Write-Host "❌ Python version must be 3.10 or higher. Found: $pyVersion" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Python $pyVersion detected." -ForegroundColor Green

# Check Node
if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed." -ForegroundColor Red
    exit 1
}

$nodeVersionString = node -v
$nodeMajorVersion = [int]($nodeVersionString -replace '^v', '' -split '\.')[0]
if ($nodeMajorVersion -lt 18) {
    Write-Host "❌ Node.js version must be 18 or higher. Found: $nodeMajorVersion" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js $nodeVersionString detected." -ForegroundColor Green

# Set up Backend
Write-Host "📦 Setting up backend..." -ForegroundColor Cyan
Set-Location backend
if (-not (Test-Path "venv")) {
    & $pythonCmd -m venv venv
}
& .\venv\Scripts\python.exe -m pip install -r requirements.txt
& .\venv\Scripts\python.exe -m spacy download en_core_web_sm

if (-not (Test-Path ".env")) {
    Copy-Item .env.example .env
    Write-Host "⚠️  Created backend/.env. Please update GROQ_API_KEY inside it." -ForegroundColor Yellow
}
Set-Location ..

# Set up Dashboard
Write-Host "📦 Setting up dashboard..." -ForegroundColor Cyan
Set-Location dashboard
npm install
Set-Location ..

# Set up SDK
Write-Host "📦 Setting up SDK..." -ForegroundColor Cyan
Set-Location sdk
npm install
npm run build
Set-Location ..

Write-Host ""
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "To start the system:"
Write-Host "1. Start Backend:   cd backend; .\venv\Scripts\activate; uvicorn main:app --reload"
Write-Host "2. Start Dashboard: cd dashboard; npm run dev"
Write-Host "3. Register App:    curl -Method Post -Uri http://localhost:8000/apps/register -Body '{\`"name\`":\`"My Test App\`"}' -ContentType 'application/json'"
Write-Host "===========================================" -ForegroundColor Cyan

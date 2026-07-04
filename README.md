# Sentinel: AI Security Middleware

> **Sentinel is self-hosted — clone this repo, run `./setup.sh`, and you're running your own instance. No shared/hosted version is provided.**

Sentinel is an open-source, framework-agnostic middleware layer designed to protect AI Agents and Large Language Models (LLMs) from prompt injections, jailbreaks, and PII (Personally Identifiable Information) leakage.

<p align="center">
  <img src="dashboard-preview.png" alt="Sentinel Dashboard showing live incidents" width="800">
</p>

## Overview
Traditional application security tools (WAFs, SQL injection filters) fail against LLM attacks because the payloads are written in natural language, not code. Sentinel sits between your users and your AI model, analyzing every message in real-time.

It uses a hybrid approach:
- **Heuristic & Regex Rules**: For ultra-fast, cheap detection of known PII patterns and hardcoded injection phrases.
- **LLM-as-a-Judge**: For deeper semantic analysis of complex jailbreak attempts (using Llama 3).

## Features
- **Plug-and-Play API**: Send user messages to `/analyze` before passing them to OpenAI/Anthropic.
- **Live Dashboard**: Real-time Next.js dashboard showing active incidents, attack vectors, and a 7-day risk trend via WebSockets.
- **Customizable Thresholds**: Adjust how aggressive the system blocks traffic based on risk scores (0-100).
- **Zero-Latency Fail-Open**: If Sentinel goes down, your app keeps running.

## Project Structure
- `/backend`: FastAPI Python server containing the core detection logic, risk scoring engine, and SQLite database.
- `/dashboard`: Next.js web application for real-time monitoring and analytics visualization.
- `/sdk`: (Optional) Lightweight TypeScript wrapper for easy integration into Node.js apps.

## Quick Start

### Running Locally
To test end-to-end functionality locally, consult the included [Getting Started Guide](docs/GETTING_STARTED.md).

## Production Deployment (Render + Vercel)

Sentinel is designed to be easily deployed to PaaS providers like Render and Vercel. 

### Backend (Render)
A `render.yaml` file is included in the root of the repository for automated Infrastructure-as-Code deployment. 
1. Create a PostgreSQL database on Render.
2. Deploy the `sentinel-backend` web service from the repository.
3. Configure `GROQ_API_KEY` and `CORS_ORIGINS` in your Render environment variables. 

### Dashboard (Vercel)
A `vercel.json` file is included in the `dashboard` directory for Next.js deployment.
1. Import the repository into Vercel.
2. **Crucial Step:** Set the "Root Directory" to `dashboard` (as this is a monorepo).
3. Add the `NEXT_PUBLIC_API_URL` environment variable in Vercel's project settings, pointing to your deployed Render backend URL (e.g. `https://sentinel-backend.onrender.com`).

---
## Project Origins:
We have created a one-command setup script to get you up and running in under 2 minutes.

**Please see the full guide here: [Getting Started Guide](docs/GETTING_STARTED.md)**

It covers:
1. Running the `setup.sh` script.
2. Generating your App ID and API Key.
3. Integrating the `@ashwinjauhary/sentinel-guard` SDK into your code.
4. Logging into the Dashboard.

## Security Notes
This is a demonstration build meant for self-hosting. Never commit your `.db` files or `.env` files. There is no automated API key rotation mechanism provided out-of-the-box.

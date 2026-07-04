# Getting Started with Sentinel (A-Z Guide)

Sentinel is an open-source, self-hosted AI security middleware. It intercepts prompts sent to your Large Language Models (LLMs) and blocks jailbreaks, prompt injections, and PII leaks before they reach the model.

Because Sentinel is self-hosted, you run it entirely on your own infrastructure. There is no shared cloud API to pay for, and your data never leaves your environment.

---

## 🚀 Step 1: Clone and Initialize
First, clone the repository and run the setup script. This script will automatically create a Python virtual environment, download the required NLP models (Spacy), and install Node.js dependencies for both the Dashboard and the SDK.

```bash
git clone https://github.com/Ashwinjauhary/Sentinel.git
cd Sentinel
./setup.sh
```
*(Windows users: Run `.\setup.ps1` in PowerShell).*

---

## 🗄️ Step 2: Database Setup
Sentinel uses **SQLite** by default, meaning you do not need to install any external database software to test it locally. The tables are automatically created on startup.

If you are deploying to **Production**, you should use PostgreSQL.
1. Open the newly generated `backend/.env` file.
2. Change the `DATABASE_URL` line:
   ```env
   # Local testing
   # DATABASE_URL=sqlite:///./sentinel.db
   
   # Production
   DATABASE_URL=postgresql://user:password@hostname:5432/db_name
   ```
*Sentinel will automatically create all required tables on the first run, regardless of which database you use.*

---

## 🤖 Step 3: AI Assistant Setup (Q/A Feature)
Sentinel includes an AI-powered Threat Analysis Assistant in the dashboard, which helps you analyze blocked incidents. It uses Groq's high-speed inference API.

1. Go to [console.groq.com](https://console.groq.com) and create a free API Key.
2. Open `backend/.env` and add your key:
   ```env
   GROQ_API_KEY=gsk_your_api_key_here
   ```
*(If you do not provide this key, the AI Assistant feature in the dashboard will simply be disabled, but all core security blocking will continue to function normally).*

---

## 🏃 Step 4: Start the Servers
You need to run the Backend API and the Frontend Dashboard in two separate terminal windows.

**Terminal 1 (Backend):**
```bash
cd backend
source venv/bin/activate    # (Windows: .\venv\Scripts\activate)
uvicorn main:app --reload
```

**Terminal 2 (Dashboard):**
```bash
cd dashboard
npm run dev
```

---

## 🔑 Step 5: Register Your App
Once your backend is running on `http://localhost:8000`, you must register your application. This gives you the credentials needed to access the dashboard and use the SDK.

Run this command in your terminal:
```bash
curl -X POST http://localhost:8000/apps/register \
  -H "Content-Type: application/json" \
  -d '{"name":"My AI App"}'
```

**Example Response:**
```json
{
  "app_id": "8a7b9c12-34de-56f7-89ab-cdef01234567",
  "api_key": "sk_live_v2XxZ...",
  "name": "My AI App"
}
```
> **⚠️ CRITICAL**: Save this `api_key` immediately! It is cryptographically generated and is never shown again. If you lose it, you must register a new app.

---

## 🛡️ Step 6: Secure Your LLM Code
In your existing Node.js/TypeScript AI application, install the Sentinel Guard SDK:

```bash
npm install @ashwinjauhary/sentinel-guard
```

Wrap your existing AI logic with the `guard()` function:

```typescript
import { SentinelGuard } from "@ashwinjauhary/sentinel-guard";
import OpenAI from "openai";

const openai = new OpenAI();
const sentinel = new SentinelGuard({
  appId: "YOUR_APP_ID",           // From Step 5
  apiKey: "YOUR_API_KEY",         // From Step 5
  apiUrl: "http://localhost:8000" // Point to your self-hosted instance URL in production
});

async function chatWithBot(userMessage: string) {
  // 1. Guard the message
  const result = await sentinel.guard(userMessage);

  // 2. Block if necessary
  if (!result.allowed) {
    console.error("Threat detected:", result.reasons);
    return "I cannot fulfill this request due to security policies.";
  }

  // 3. Proceed safely
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: userMessage }]
  });
  
  return response.choices[0].message.content;
}
```

---

## 📊 Step 7: Monitor in Real-Time
Open your browser and navigate to the Sentinel Dashboard:

🔗 `http://localhost:3000/login`

Enter the `app_id` and `api_key` you generated in **Step 5**. You will now see a live, animated telemetry feed of all allowed and blocked requests. You can also click on incidents to use the Groq-powered AI Assistant to analyze the attack vectors!

---

## ❓ FAQ

**What happens if my Sentinel backend goes down?**
Sentinel uses a "Fail-Open" architecture. If the SDK cannot reach your backend (or if it times out after 500ms), it will automatically log a warning and *allow* the message through. Your AI app will never experience downtime because of a Sentinel crash.

**Is my API key visible anywhere in the database?**
No, Sentinel does not have a "reveal key" feature. The key is only displayed once upon registration. If you lose it, you must register a new app.

**Is there a hosted cloud version I can just pay for?**
No. Sentinel is self-hosted. You must run the backend and dashboard on your own servers (e.g., Render, Heroku, AWS, or Vercel).

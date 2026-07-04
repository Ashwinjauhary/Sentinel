# Getting Started with Sentinel

Sentinel is an open-source, self-hosted AI security middleware. It intercepts prompts sent to your Large Language Models (LLMs) and blocks jailbreaks, prompt injections, and PII leaks before they reach the model.

Because Sentinel is self-hosted, you run it entirely on your own infrastructure. There is no shared cloud API to pay for, and your data never leaves your environment.

## 🚀 5-Minute Onboarding

### Step 1: Start Your Instance
First, clone the repository and run the setup script to install all dependencies and start the backend/dashboard.

```bash
git clone https://github.com/Ashwinjauhary/Sentinel.git
cd Sentinel
./setup.sh
```

*(Windows users: Run `.\setup.ps1` in PowerShell).*

Start the backend and dashboard in separate terminals as instructed by the setup script.

### Step 2: Register an App
Once your backend is running (`http://localhost:8000`), register a new application. This will give you an App ID and an API Key.

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
> **⚠️ WARNING**: Save this `api_key` immediately! It is cryptographically generated and is never shown again.

### Step 3: Install the SDK
In your existing Node.js/TypeScript AI application, install the Sentinel Guard SDK:

```bash
npm install @ashwinjauhary/sentinel-guard
```

### Step 4: Secure Your LLM Calls
Wrap your existing AI logic with the `guard()` function. 

```typescript
import { SentinelGuard } from "@ashwinjauhary/sentinel-guard";
import OpenAI from "openai";

const openai = new OpenAI();
const sentinel = new SentinelGuard({
  appId: "YOUR_APP_ID",         // From Step 2
  apiKey: "YOUR_API_KEY",       // From Step 2
  apiUrl: "http://localhost:8000" 
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

### Step 5: Monitor in Real-Time
Open your browser and navigate to the Sentinel Dashboard:

🔗 `http://localhost:3000/login`

Enter the `app_id` and `api_key` you generated in Step 2. You will now see a live, animated telemetry feed of all allowed and blocked requests.

---

## ❓ FAQ

**What happens if my Sentinel backend goes down?**
Sentinel uses a "Fail-Open" architecture. If the SDK cannot reach your backend (or if it times out after 500ms), it will automatically log a warning and *allow* the message through. Your AI app will never experience downtime because of a Sentinel crash.

**Is my API key visible anywhere in the database?**
No, Sentinel does not have a "reveal key" feature. The key is only displayed once upon registration. If you lose it, you must register a new app.

**Is there a hosted cloud version I can just pay for?**
No. Sentinel is self-hosted. You must run the backend and dashboard on your own servers (e.g., Render, Heroku, AWS, or Vercel).

# SENTINEL — "MAKE IT USABLE BY OTHERS" UPGRADE
### Full AI-IDE Prompt Library for Self-Serve Onboarding, Public SDK, and Dashboard Auth

Goal: Turn Sentinel from "a project only I can run locally" into "a tool any developer can sign up for and use in 5 minutes." Paste these prompts in order into Cursor/Windsurf/Claude Code.

---

## U1 — Self-Serve App Registration Endpoint
```
Add a new endpoint to backend/main.py:

POST /apps/register
Request body: { "name": str }
Response: { "app_id": str (UUID), "api_key": str, "name": str }

Logic:
1. Generate a new UUID for app_id
2. Generate a cryptographically secure random API key (use secrets.token_urlsafe(32),
   prefixed with "sk_live_" for readability, e.g. "sk_live_AbC123...")
3. Create a new App row with these values and a default threshold of 70
4. Return the app_id and api_key ONCE in the response

Important: Add a docstring/comment warning that the api_key is only shown once at
registration time and is never retrievable again (store only the key itself in DB,
not a separate "reveal" mechanism, to keep this simple for a student project).

Also add basic abuse protection: rate-limit this endpoint to 5 registrations per
IP per hour using an in-memory counter (slowapi library or a simple dict-based
limiter), since this is a public unauthenticated endpoint.
```

## U2 — Dashboard Login Flow (API-key-based, no full user accounts needed)
```
Modify the Next.js dashboard (dashboard/src/app/) to add a simple login gate:

1. Create a new page at /login with a single form: two inputs (App ID, API Key)
   and a "View Dashboard" button
2. On submit, POST to the backend's /apps/verify endpoint (create this new backend
   endpoint: it takes { app_id, api_key } and returns { valid: bool, name: str }
   by checking against the apps table)
3. If valid, store app_id and api_key in React state (NOT localStorage, since
   artifacts/some environments restrict it — use a session-scoped context provider
   that lives for the browser tab session) and redirect to /dashboard
4. Update the existing /dashboard page to read app_id/api_key from this context
   instead of a hardcoded value, and pass the api_key as an Authorization header
   on all API calls (/incidents, /stats)
5. If no valid session exists, redirect any visit to /dashboard back to /login

This keeps things simple (no passwords, no email, no session cookies) while still
preventing casual unauthorized dashboard access.
```

## U3 — Secure the Remaining GET Endpoints
```
Now that a proper login flow exists, close the previously documented gap:

Add the same api_key_header dependency (already used in /analyze and /apps/{id}/threshold)
to the GET /incidents and GET /stats endpoints in backend/main.py. Each should:
1. Require a valid Authorization: Bearer <api_key> header
2. Verify the api_key matches the app_id being requested (query param), returning
   401 if it does not
3. Update the dashboard's fetch calls (from U2) to include this header

This closes the "Unauthenticated Telemetry Endpoints" limitation documented in the
whitepaper.
```

## U4 — Prepare and Publish the SDK to npm
```
Prepare the sdk/ package for public npm publishing:

1. Update sdk/package.json with: a real npm-safe package name (check if
   "sentinel-guard" is taken on npmjs.com first, and use a scoped name like
   "@ashwinjauhary/sentinel-guard" if needed), version "1.0.0", description,
   keywords (ai-security, llm, prompt-injection, jailbreak-detection), repository
   URL pointing to the GitHub repo, license "MIT", and proper "files" field
   listing only the dist/ folder and README
2. Add a build script using tsc that compiles src/index.ts to dist/
3. Write a clear README.md specifically for the SDK package (separate from the
   monorepo root README) with: install command, a 5-line quickstart example,
   full GuardOptions/GuardResponse type documentation, and a link to the live
   dashboard/backend if hosted
4. Add a LICENSE file (MIT) at the sdk/ root
5. Output the exact terminal commands needed to publish: npm login, npm run build,
   npm publish --access public (explain what each does, don't run them — I'll run
   them myself after reviewing)
```

## U5 — Public "Getting Started" Documentation Page
```
Create a new file docs/GETTING_STARTED.md (and also add a prominent link to it from
the root README.md) that walks a completely new developer through using Sentinel
without needing to read any other file:

1. What Sentinel is (2 sentences, no jargon)
2. Step 1: Register for an app — show the exact curl command to POST /apps/register
   against the hosted instance URL (use a placeholder like YOUR_SENTINEL_URL that
   I will fill in after deployment), and show an example response
3. Step 2: Install the SDK — npm install command
4. Step 3: Add 4 lines of code to their existing app — show a complete, runnable
   example wrapping a hypothetical OpenAI chat completion call with guard()
5. Step 4: View your dashboard — link to /login with their app_id
6. A short FAQ: "What happens if Sentinel is down?" (fail-open explanation),
   "Is my API key visible anywhere?" (no, shown once), "Can I self-host this
   instead of using the hosted version?" (yes, link to root README's local
   setup instructions)

Write this in a friendly, Stripe-docs-style tone — short paragraphs, real code
blocks, no unnecessary theory.
```

## U6 — Rate Limiting on /analyze (protect shared hosted instance)
```
Add per-app rate limiting to the /analyze endpoint in backend/main.py so that if
Sentinel is hosted as a shared public instance, one app can't exhaust resources
for everyone else:

1. Use an in-memory sliding-window counter (dict keyed by app_id, or use the
   slowapi library if already comfortable with it) limiting each app_id to
   100 requests per minute by default
2. If exceeded, return 429 Too Many Requests with a Retry-After header
3. Make the limit configurable per-app by adding a rate_limit_per_minute column
   to the apps table (default 100), so paying/trusted apps could get higher
   limits in the future
4. Document this limit in docs/GETTING_STARTED.md's FAQ section
```

## U7 — One-Command Local Setup Script (for self-hosters)
```
Create a setup.sh (and setup.ps1 for Windows) script at the repo root that:
1. Checks Python 3.10+ and Node 18+ are installed, prints a clear error if not
2. Creates a Python venv in backend/, activates it, installs requirements.txt
3. Runs python -m spacy download en_core_web_sm
4. Copies backend/.env.example to backend/.env if it doesn't exist, and prints
   a reminder to add GROQ_API_KEY
5. Installs dashboard/ and sdk/ npm dependencies
6. Prints final instructions: how to start the backend, how to start the
   dashboard, and how to register a test app via curl

Also create backend/.env.example (not .env) with GROQ_API_KEY=your_key_here and
DATABASE_URL=sqlite:///./sentinel.db as placeholder content, safe to commit.
```

---

## ⚠️ DECISION MADE: Self-Host-Only (Option B)

Sentinel will be a self-hosted tool — every developer clones the repo and runs their
own instance. There is no shared/hosted public instance. This changes the priority
order below: setup ease (U7) now matters most, and rate limiting (U6) is no longer
needed since each instance only serves its own owner.

## Revised rollout order (self-host-only)

1. **U7 first** — one-command setup script. This is now the core deliverable: anyone
   who clones the repo should be running in under 2 minutes.
2. **U1** — self-serve app registration. Still needed so a self-hoster can create
   multiple apps on their own instance without manually touching the database.
3. **U5** — Getting Started docs, rewritten to describe the exact self-host flow:
   `git clone → ./setup.sh → curl /apps/register → npm install sentinel-guard → 4 lines of code`
4. **U2, U3** — dashboard login + closing the remaining auth gap. Still worth doing
   for good security hygiene and as a viva talking point, but not urgent since it's
   the developer's own local data.
5. **U4** — npm publish. Optional bonus: makes the SDK independently useful and adds
   "published open-source package" to your portfolio, but not required for the
   self-host story to work.
6. ~~**U6** — rate limiting~~ — **SKIPPED.** This was only relevant for a shared
   hosted instance protecting against one app exhausting resources for everyone
   else. In self-host-only mode, each instance serves only its own owner, so this
   is unnecessary complexity. Do not implement this.

## After this, update your README and whitepaper

Once U1–U7 are done, two docs need updating:
- **README.md**: replace the manual "seed a demo app in the DB" instructions with the new `POST /apps/register` flow
- **Whitepaper Section 8 (Known Limitations)**: remove the "Unauthenticated Telemetry Endpoints" item since U3 fixes it — but add a new honest note about the new limitations this introduces (e.g., "no password recovery," "single API key with no rotation mechanism yet") so the report stays accurate rather than just shrinking the limitations list to look better.

## Confirmed direction

**Self-host-only, decided.** Every developer runs their own copy via `git clone` +
`./setup.sh`. No shared hosted URL, no ongoing hosting cost or uptime responsibility
for you. Add this line near the top of README.md so expectations are clear immediately:

> "Sentinel is self-hosted — clone this repo, run `./setup.sh`, and you're running
> your own instance. No shared/hosted version is provided."

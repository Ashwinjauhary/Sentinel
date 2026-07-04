# SENTINEL — FULL TESTING PROMPT LIBRARY
### Copy-paste these into Cursor/Windsurf/Claude Code, one module at a time. Review every generated test before running it.

---

## T1 — Injection Detector Unit Tests
```
Write pytest unit tests for detectors/injection.py covering:
1. Exact-match cases: 5 known injection phrases from our rules list (should return is_injection=True)
2. Fuzzy-match cases: 5 deliberately misspelled/reworded versions of those same phrases
   (e.g., "ignore prevous instructons") that should still trigger via rapidfuzz (confidence >= 0.8)
3. Negative cases: 10 completely benign messages that should NOT trigger (is_injection=False)
4. Edge cases: empty string, very long string (5000+ chars), string with only special
   characters, string in a non-English language
5. Boundary case: a message that's exactly at the 80% fuzzy match threshold — verify
   behavior is consistent (document whether >= or > is used)

Assert on both is_injection (bool) and confidence (float) fields. Use pytest.mark.parametrize
to keep it readable.
```

## T2 — PII Detector Unit Tests
```
Write pytest unit tests for detectors/pii.py covering:
1. Each PII type individually: email only, phone only (Indian format), phone only
   (international format), credit-card-like number only
2. Multiple PII types in a single message (should return match_count > 1 and correct
   matched_types list)
3. spaCy NER cases: a message with a person's name, a message with a location, a message
   with an organization name — verify each is caught
4. False-positive resistance: a message with numbers that look like phone numbers but
   aren't (e.g., a product SKU, a year like "2026", a price like "₹4999") — verify these
   do NOT incorrectly trigger phone/PII detection
5. Mixed case: a benign message that happens to mention a real company name (e.g., in
   a customer support context asking about a competitor) — confirm this is flagged
   as PII-adjacent but document whether that's a false positive worth tuning

Return a summary table of pass/fail per case at the end of the test run.
```

## T3 — Jailbreak Detector Tests (both Groq path and fallback path)
```
Write pytest tests for detectors/jailbreak.py that cover TWO separate scenarios:

SCENARIO A — Groq API available (mock the Groq client):
1. Mock a Groq response returning is_jailbreak_attempt=True, confidence=0.9 — verify
   the function correctly parses and returns this
2. Mock a Groq response wrapped in markdown code fences (```json ... ```) — verify the
   parser strips them correctly
3. Mock a malformed/non-JSON Groq response — verify the function falls back gracefully
   instead of crashing

SCENARIO B — Groq API unavailable (simulate a network error or timeout):
1. Simulate a raised exception from the Groq client call — verify the heuristic regex
   fallback engine activates automatically
2. Test the fallback engine directly with known patterns: "pretend you are", "for
   educational purposes only", "I am the system admin" — verify each triggers a
   reasonable confidence score
3. Test the fallback engine with a benign message containing the word "pretend" in an
   innocent context (e.g., "let's pretend this is a birthday party invitation") — check
   for false positives and document the result

Report which scenario (A or B) was actually exercised in each test via clear test names.
```

## T4 — Risk Scoring Formula Tests
```
Write pytest unit tests for the risk scoring function in main.py that verify the exact
formula: score = min(100, (40 * injection_confidence) + (35 * jailbreak_confidence) +
(25 * min(pii_match_count, 3))).

Test cases:
1. All three detectors return 0 confidence/0 matches -> score should be 0
2. Only injection triggers at confidence 1.0 -> score should be exactly 40
3. Only jailbreak triggers at confidence 1.0 -> score should be exactly 35
4. Only PII triggers with match_count=5 (above the cap of 3) -> score should be
   capped correctly at 25, not 41.67
5. All three trigger at max simultaneously -> score should cap at 100, not overflow
6. A combination that lands exactly on the 40-threshold boundary -> verify the
   allowed/blocked decision matches the documented threshold logic (>= vs >)
7. Verify the score is always returned as an integer, never a float, per the
   documented spec

Print a small table showing input confidences vs expected vs actual score for each case.
```

## T5 — /analyze Endpoint Integration Tests
```
Write FastAPI TestClient integration tests for the POST /analyze endpoint covering:
1. Happy path: valid app_id + api_key header + benign message -> expect 200,
   allowed=true, low score
2. Happy path: valid app_id + api_key header + known adversarial message -> expect
   200, allowed=false, high score, incident_id present
3. Auth failure: missing Authorization header -> expect 401
4. Auth failure: wrong api_key for a valid app_id -> expect 401
5. Auth failure: valid api_key but wrong app_id (mismatched pair) -> expect 401
6. Validation failure: missing "message" field in request body -> expect 422
7. Validation failure: message field is not a string (e.g., a number or null) -> expect 422
8. Verify that a successful /analyze call actually creates a row in the incidents
   table (query the test DB directly to confirm persistence)
9. Verify that when score >= 40, a WebSocket broadcast is triggered (mock the
   socketio emit call and assert it was called with the correct payload shape)

Use a fresh in-memory SQLite test database for isolation, reset between tests.
```

## T6 — /incidents and /stats Endpoint Tests
```
Write FastAPI TestClient tests for GET /incidents and GET /stats:

For /incidents:
1. Pagination works correctly (limit/offset parameters return the right slice)
2. Filtering by app_id only returns that app's incidents, never another app's
   (critical multi-tenant isolation test)
3. Empty result set (new app with no incidents) returns an empty list, not an error

For /stats:
1. daily_scores aggregation returns correct averages for a seeded set of incidents
   across multiple days
2. attack_type_counts correctly tallies injection vs jailbreak vs pii flags
3. Requesting stats for a non-existent app_id returns an empty/zeroed response,
   not a 500 error

Seed the test database with at least 10 incidents spanning 3 different days and
2 different app_ids before running these tests.
```

## T7 — WebSocket Real-Time Tests
```
Write a test (using python-socketio's test client or a pytest-asyncio approach) that:
1. Connects a mock client to /ws with a given app_id
2. Triggers an /analyze call via HTTP that should produce a high-risk incident
3. Asserts the connected WebSocket client receives the incident payload within
   2 seconds (per the documented NFR)
4. Verifies multi-tenant isolation: a second client connected under a DIFFERENT
   app_id does NOT receive the same incident (this is a critical security/privacy test)
5. Tests graceful disconnect/reconnect handling — client disconnects mid-session,
   reconnects, and resumes receiving new incidents without needing a full app restart
```

## T8 — SDK (sentinel-guard) Tests
```
Write Jest/Vitest tests for the sentinel-guard npm package covering:
1. Successful guard() call: mock a fetch response with allowed=true — verify the
   function returns the parsed result correctly
2. Blocked call: mock a fetch response with allowed=false — verify reasons array
   is passed through correctly
3. Fail-open behavior: mock a network error (fetch throws) — verify guard() returns
   { allowed: true, score: 0, reasons: [] } instead of throwing, per the documented
   fail-open design
4. Fail-open behavior: mock a non-200 HTTP response (e.g., 500 from backend) —
   verify the same fail-open fallback triggers
5. TypeScript type check: verify GuardOptions interface rejects a call missing
   required fields at compile time (this is a type-level test, not runtime)
6. Timeout handling: mock a fetch that never resolves — verify guard() has a
   reasonable timeout and doesn't hang indefinitely
```

## T9 — Dashboard Frontend Tests
```
Write React Testing Library tests for the dashboard (app/dashboard/page.tsx) covering:
1. Initial render: component mounts without crashing when /stats returns valid data
2. Live feed: simulate a WebSocket message event and verify a new row appears at
   the top of the incident table
3. Color coding: verify a score of 20 renders green, 55 renders amber/yellow, and
   85 renders red in the table (test the color-mapping logic specifically)
4. Threshold slider: simulate moving the slider and verify it triggers a PATCH
   request to /apps/:id/threshold with the correct value
5. Empty state: verify the dashboard shows a sensible empty state when there are
   zero incidents, rather than a broken chart
6. Error state: mock a failed /stats fetch and verify the dashboard shows an error
   message instead of crashing silently
```

## T10 — End-to-End Smoke Test Script
```
Write a single Python script full_smoke_test.py that, against a locally running
instance of the full stack, does the following in sequence and prints PASS/FAIL
for each step:

1. Health check: GET / on the backend returns 200
2. Register/verify a test app exists in the DB with a known api_key
3. Send a benign message to /analyze -> verify allowed=true
4. Send a known injection attack -> verify allowed=false, injection_flag=true
5. Send a known jailbreak attempt -> verify allowed=false, jailbreak_flag=true
6. Send a message containing an email address -> verify pii_flag=true
7. Fetch /incidents for the test app and verify all 4 above incidents appear
8. Fetch /stats and verify attack_type_counts reflects the above correctly
9. Attempt /analyze with a missing Authorization header -> verify 401
10. Attempt /analyze with an app_id that doesn't exist -> verify 401 (not 404 or 500)

Exit with a non-zero code if any step fails, and print a final summary table of
all 10 steps with PASS/FAIL status. This script is your one-command "is everything
still working" check before any demo or submission.
```

## T11 — Security-Specific Adversarial Tests (test the tester)
```
Write a dedicated test file test_security_hardening.py that probes Sentinel's own
security posture, not just its detection accuracy:

1. SQL injection attempt in the app_id field of /analyze (e.g., "1' OR '1'='1") —
   verify SQLAlchemy parameterization prevents any injection, and the request is
   rejected cleanly (400/401), not a 500 error that could leak a stack trace
2. Extremely large payload (e.g., a 10MB message body) — verify the API rejects it
   gracefully with a 413 or similar, rather than crashing or hanging the server
3. Rapid-fire requests from the same app_id (50 requests in 1 second) — document
   current behavior (no rate limiting is expected yet per the PRD, but this test
   documents that gap explicitly so it's not a surprise later)
4. Attempt to access /incidents or /stats for one app_id using another app's
   api_key — verify strict isolation (this overlaps with T6 #2 but tests it from
   an adversarial angle, not just a functional one)
5. Verify error responses never leak internal details (stack traces, file paths,
   raw SQL, or the database URL) in production mode
```

## T12 — Report-Ready Metrics Script
```
Extend test_scenarios.py (or write a new metrics_report.py) that runs the full
50-prompt test set and outputs a clean markdown table with:
- Overall recall, precision, F1 score (not just recall and FPR)
- A confusion matrix (true positive / false positive / true negative / false negative)
- Per-category breakdown: recall specifically for injection-only prompts,
  jailbreak-only prompts, and PII-only prompts (since a single blended recall
  number can hide that one detector is much weaker than the others)
- Average response latency per request, to validate against the < 800ms NFR

Output this as a markdown table that can be pasted directly into Part 7
(Testing & Results) of the whitepaper, replacing the current simplified table.
```

---

## Suggested run order

1. **T1, T2, T3, T4** first — these are pure unit tests, no server needed, fastest feedback loop
2. **T5, T6** next — need a running backend + test DB
3. **T7** — needs backend + WebSocket support running
4. **T8, T9** — SDK and dashboard, can run in parallel with backend tests since they're separate codebases
5. **T10** — run this after everything above passes, as your final gate before any demo
6. **T11** — run once, document results honestly in the report even if some gaps exist (rate limiting, for example) — this is expected and shows security maturity to acknowledge, not hide
7. **T12** — run last, use its output to replace/strengthen Part 7 of your whitepaper with per-category numbers instead of one blended number

## One rule to keep, given everything that happened earlier in this project

Whatever numbers T12 produces — **use them exactly as generated, do not adjust thresholds or targets afterward to make them look better.** If per-category recall reveals jailbreak detection is much weaker than injection detection (likely, given it's the hardest category), that's a legitimate, reportable limitation — not something to hide or average away.
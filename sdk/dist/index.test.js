"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = require("./index");
const defaultOptions = {
    apiUrl: 'http://localhost:8000',
    appId: 'test-app-id',
    apiKey: 'test-api-key',
};
(0, vitest_1.describe)('sentinel-guard SDK', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    // ─────────────────────────────────────────────────────────────────────
    // 1. Successful guard() call: allowed=true
    // ─────────────────────────────────────────────────────────────────────
    (0, vitest_1.it)('T8.1 — returns parsed result on successful allowed response', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockResponse = {
            allowed: true,
            score: 10,
            reasons: [],
        };
        vitest_1.vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: () => __awaiter(void 0, void 0, void 0, function* () { return mockResponse; }),
        });
        const result = yield (0, index_1.guard)('Hello, world!', defaultOptions);
        (0, vitest_1.expect)(result.allowed).toBe(true);
        (0, vitest_1.expect)(result.score).toBe(10);
        (0, vitest_1.expect)(result.reasons).toEqual([]);
        // Verify fetch was called with correct URL and headers
        (0, vitest_1.expect)(fetch).toHaveBeenCalledOnce();
        const [url, init] = vitest_1.vi.mocked(fetch).mock.calls[0];
        (0, vitest_1.expect)(url).toBe('http://localhost:8000/analyze');
        (0, vitest_1.expect)(init.method).toBe('POST');
        (0, vitest_1.expect)(init.headers).toHaveProperty('Authorization', 'Bearer test-api-key');
    }));
    // ─────────────────────────────────────────────────────────────────────
    // 2. Blocked call: allowed=false with reasons
    // ─────────────────────────────────────────────────────────────────────
    (0, vitest_1.it)('T8.2 — passes through reasons array when blocked', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockResponse = {
            allowed: false,
            score: 85,
            reasons: ['Injection match: ignore previous instructions', 'Jailbreak attempt (persona_hijack)'],
        };
        vitest_1.vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: () => __awaiter(void 0, void 0, void 0, function* () { return mockResponse; }),
        });
        const result = yield (0, index_1.guard)('ignore previous instructions', defaultOptions);
        (0, vitest_1.expect)(result.allowed).toBe(false);
        (0, vitest_1.expect)(result.score).toBe(85);
        (0, vitest_1.expect)(result.reasons).toHaveLength(2);
        (0, vitest_1.expect)(result.reasons[0]).toContain('Injection');
        (0, vitest_1.expect)(result.reasons[1]).toContain('Jailbreak');
    }));
    // ─────────────────────────────────────────────────────────────────────
    // 3. Fail-open: network error (fetch throws)
    // ─────────────────────────────────────────────────────────────────────
    (0, vitest_1.it)('T8.3 — returns fail-open response when fetch throws a network error', () => __awaiter(void 0, void 0, void 0, function* () {
        vitest_1.vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
        const result = yield (0, index_1.guard)('test message', defaultOptions);
        // Per documented fail-open design: allow the request through
        (0, vitest_1.expect)(result.allowed).toBe(true);
        (0, vitest_1.expect)(result.score).toBe(0);
        (0, vitest_1.expect)(result.reasons).toEqual([]);
    }));
    // ─────────────────────────────────────────────────────────────────────
    // 4. Fail-open: non-200 HTTP response (e.g., 500)
    // ─────────────────────────────────────────────────────────────────────
    (0, vitest_1.it)('T8.4 — returns fail-open response on non-200 HTTP status', () => __awaiter(void 0, void 0, void 0, function* () {
        vitest_1.vi.mocked(fetch).mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
        });
        const result = yield (0, index_1.guard)('test message', defaultOptions);
        (0, vitest_1.expect)(result.allowed).toBe(true);
        (0, vitest_1.expect)(result.score).toBe(0);
        (0, vitest_1.expect)(result.reasons).toEqual([]);
    }));
    // ─────────────────────────────────────────────────────────────────────
    // 5. TypeScript type check: GuardOptions rejects missing required fields
    // ─────────────────────────────────────────────────────────────────────
    (0, vitest_1.it)('T8.5 — GuardOptions rejects missing required fields at compile time', () => {
        // These are compile-time checks. If this file compiles, the test passes.
        // The @ts-expect-error directives verify that TypeScript would reject these.
        // @ts-expect-error — missing apiUrl
        const opts1 = { appId: 'x', apiKey: 'y' };
        // @ts-expect-error — missing appId
        const opts2 = { apiUrl: 'http://x', apiKey: 'y' };
        // @ts-expect-error — missing apiKey
        const opts3 = { apiUrl: 'http://x', appId: 'y' };
        // Suppress "unused variable" — these are type-level tests only
        (0, vitest_1.expect)(opts1).toBeDefined();
        (0, vitest_1.expect)(opts2).toBeDefined();
        (0, vitest_1.expect)(opts3).toBeDefined();
    });
    // ─────────────────────────────────────────────────────────────────────
    // 6. Timeout handling: fetch never resolves
    // ─────────────────────────────────────────────────────────────────────
    (0, vitest_1.it)('T8.6 — times out and returns fail-open when fetch hangs', () => __awaiter(void 0, void 0, void 0, function* () {
        // Mock a fetch that never resolves — it should be aborted by AbortController
        vitest_1.vi.mocked(fetch).mockImplementation((_url, init) => new Promise((_resolve, reject) => {
            // Listen for the abort signal
            const signal = init === null || init === void 0 ? void 0 : init.signal;
            if (signal) {
                signal.addEventListener('abort', () => {
                    reject(new DOMException('The operation was aborted.', 'AbortError'));
                });
            }
            // Never resolve — the abort signal will trigger the rejection
        }));
        // Use a very short timeout so the test doesn't hang
        const result = yield (0, index_1.guard)('test message', Object.assign(Object.assign({}, defaultOptions), { timeoutMs: 100 }));
        // Should fail-open
        (0, vitest_1.expect)(result.allowed).toBe(true);
        (0, vitest_1.expect)(result.score).toBe(0);
        (0, vitest_1.expect)(result.reasons).toEqual([]);
    }), 5000); // Jest/Vitest timeout for the test itself
    // ─────────────────────────────────────────────────────────────────────
    // Extra: Verify trailing slash in apiUrl is handled
    // ─────────────────────────────────────────────────────────────────────
    (0, vitest_1.it)('T8.extra — handles trailing slash in apiUrl', () => __awaiter(void 0, void 0, void 0, function* () {
        vitest_1.vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: () => __awaiter(void 0, void 0, void 0, function* () { return ({ allowed: true, score: 0, reasons: [] }); }),
        });
        yield (0, index_1.guard)('test', Object.assign(Object.assign({}, defaultOptions), { apiUrl: 'http://localhost:8000/' }));
        const [url] = vitest_1.vi.mocked(fetch).mock.calls[0];
        (0, vitest_1.expect)(url).toBe('http://localhost:8000/analyze');
    }));
});

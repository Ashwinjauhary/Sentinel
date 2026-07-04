import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { guard, GuardOptions, GuardResponse } from './index';

const defaultOptions: GuardOptions = {
  apiUrl: 'http://localhost:8000',
  appId: 'test-app-id',
  apiKey: 'test-api-key',
};

describe('sentinel-guard SDK', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────
  // 1. Successful guard() call: allowed=true
  // ─────────────────────────────────────────────────────────────────────
  it('T8.1 — returns parsed result on successful allowed response', async () => {
    const mockResponse: GuardResponse = {
      allowed: true,
      score: 10,
      reasons: [],
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await guard('Hello, world!', defaultOptions);

    expect(result.allowed).toBe(true);
    expect(result.score).toBe(10);
    expect(result.reasons).toEqual([]);

    // Verify fetch was called with correct URL and headers
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('http://localhost:8000/analyze');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toHaveProperty('Authorization', 'Bearer test-api-key');
  });

  // ─────────────────────────────────────────────────────────────────────
  // 2. Blocked call: allowed=false with reasons
  // ─────────────────────────────────────────────────────────────────────
  it('T8.2 — passes through reasons array when blocked', async () => {
    const mockResponse = {
      allowed: false,
      score: 85,
      reasons: ['Injection match: ignore previous instructions', 'Jailbreak attempt (persona_hijack)'],
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await guard('ignore previous instructions', defaultOptions);

    expect(result.allowed).toBe(false);
    expect(result.score).toBe(85);
    expect(result.reasons).toHaveLength(2);
    expect(result.reasons[0]).toContain('Injection');
    expect(result.reasons[1]).toContain('Jailbreak');
  });

  // ─────────────────────────────────────────────────────────────────────
  // 3. Fail-open: network error (fetch throws)
  // ─────────────────────────────────────────────────────────────────────
  it('T8.3 — returns fail-open response when fetch throws a network error', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await guard('test message', defaultOptions);

    // Per documented fail-open design: allow the request through
    expect(result.allowed).toBe(true);
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  // ─────────────────────────────────────────────────────────────────────
  // 4. Fail-open: non-200 HTTP response (e.g., 500)
  // ─────────────────────────────────────────────────────────────────────
  it('T8.4 — returns fail-open response on non-200 HTTP status', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    const result = await guard('test message', defaultOptions);

    expect(result.allowed).toBe(true);
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  // ─────────────────────────────────────────────────────────────────────
  // 5. TypeScript type check: GuardOptions rejects missing required fields
  // ─────────────────────────────────────────────────────────────────────
  it('T8.5 — GuardOptions rejects missing required fields at compile time', () => {
    // These are compile-time checks. If this file compiles, the test passes.
    // The @ts-expect-error directives verify that TypeScript would reject these.

    // @ts-expect-error — missing apiUrl
    const opts1: GuardOptions = { appId: 'x', apiKey: 'y' };

    // @ts-expect-error — missing appId
    const opts2: GuardOptions = { apiUrl: 'http://x', apiKey: 'y' };

    // @ts-expect-error — missing apiKey
    const opts3: GuardOptions = { apiUrl: 'http://x', appId: 'y' };

    // Suppress "unused variable" — these are type-level tests only
    expect(opts1).toBeDefined();
    expect(opts2).toBeDefined();
    expect(opts3).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────
  // 6. Timeout handling: fetch never resolves
  // ─────────────────────────────────────────────────────────────────────
  it('T8.6 — times out and returns fail-open when fetch hangs', async () => {
    // Mock a fetch that never resolves — it should be aborted by AbortController
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          // Listen for the abort signal
          const signal = (init as RequestInit)?.signal;
          if (signal) {
            signal.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }
          // Never resolve — the abort signal will trigger the rejection
        })
    );

    // Use a very short timeout so the test doesn't hang
    const result = await guard('test message', {
      ...defaultOptions,
      timeoutMs: 100, // 100ms timeout
    });

    // Should fail-open
    expect(result.allowed).toBe(true);
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
  }, 5000); // Jest/Vitest timeout for the test itself

  // ─────────────────────────────────────────────────────────────────────
  // Extra: Verify trailing slash in apiUrl is handled
  // ─────────────────────────────────────────────────────────────────────
  it('T8.extra — handles trailing slash in apiUrl', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true, score: 0, reasons: [] }),
    } as Response);

    await guard('test', { ...defaultOptions, apiUrl: 'http://localhost:8000/' });

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('http://localhost:8000/analyze');
  });
});

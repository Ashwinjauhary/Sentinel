import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SentinelGuard, GuardOptions, GuardResponse } from './index';

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

    const sentinel = new SentinelGuard(defaultOptions);
    const result = await sentinel.guard('Hello, world!');

    expect(result.allowed).toBe(true);
    expect(result.score).toBe(10);
    expect(result.reasons).toEqual([]);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('http://localhost:8000/analyze');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toHaveProperty('Authorization', 'Bearer test-api-key');
  });

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

    const sentinel = new SentinelGuard(defaultOptions);
    const result = await sentinel.guard('ignore previous instructions');

    expect(result.allowed).toBe(false);
    expect(result.score).toBe(85);
    expect(result.reasons).toHaveLength(2);
    expect(result.reasons[0]).toContain('Injection');
    expect(result.reasons[1]).toContain('Jailbreak');
  });

  it('T8.3 — returns fail-open response when fetch throws a network error', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    const sentinel = new SentinelGuard(defaultOptions);
    const result = await sentinel.guard('test message');

    expect(result.allowed).toBe(true);
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it('T8.4 — returns fail-open response on non-200 HTTP status', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    const sentinel = new SentinelGuard(defaultOptions);
    const result = await sentinel.guard('test message');

    expect(result.allowed).toBe(true);
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it('T8.5 — GuardOptions rejects missing required fields at compile time', () => {
    // @ts-expect-error — missing apiUrl
    const opts1: GuardOptions = { appId: 'x', apiKey: 'y' };

    // @ts-expect-error — missing appId
    const opts2: GuardOptions = { apiUrl: 'http://x', apiKey: 'y' };

    // @ts-expect-error — missing apiKey
    const opts3: GuardOptions = { apiUrl: 'http://x', appId: 'y' };

    expect(opts1).toBeDefined();
    expect(opts2).toBeDefined();
    expect(opts3).toBeDefined();
  });

  it('T8.6 — times out and returns fail-open when fetch hangs', async () => {
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = (init as RequestInit)?.signal;
          if (signal) {
            signal.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }
        })
    );

    const sentinel = new SentinelGuard({
      ...defaultOptions,
      timeoutMs: 100,
    });
    
    const result = await sentinel.guard('test message');

    expect(result.allowed).toBe(true);
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
  }, 5000);

  it('T8.extra — handles trailing slash in apiUrl', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true, score: 0, reasons: [] }),
    } as Response);

    const sentinel = new SentinelGuard({ ...defaultOptions, apiUrl: 'http://localhost:8000/' });
    await sentinel.guard('test');

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('http://localhost:8000/analyze');
  });
});

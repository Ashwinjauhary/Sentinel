export interface GuardOptions {
  apiUrl: string;
  appId: string;
  apiKey: string;
  userId?: string;
  /** Timeout in milliseconds. Defaults to 5000 (5 seconds). */
  timeoutMs?: number;
}

export interface GuardResponse {
  allowed: boolean;
  score: number;
  reasons: string[];
}

const DEFAULT_TIMEOUT_MS = 5000;

export class SentinelGuard {
  private options: GuardOptions;

  constructor(options: GuardOptions) {
    this.options = {
      ...options,
      apiUrl: options.apiUrl || "http://localhost:8000"
    };
  }

  public async guard(message: string, userId?: string): Promise<GuardResponse> {
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.options.apiUrl.replace(/\/$/, '')}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify({
          app_id: this.options.appId,
          message: message,
          user_id: userId || this.options.userId,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Sentinel API returned status ${response.status}`);
      }

      const data = await response.json();

      return {
        allowed: data.allowed ?? false,
        score: data.score ?? 100,
        reasons: data.reasons ?? ['API Error: Invalid response format'],
      };
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("Sentinel Guard error:", error);
      // Fail-open: allow if API is down to not block legitimate users, but flag it.
      return {
        allowed: true,
        score: 0,
        reasons: [],
      };
    }
  }
}

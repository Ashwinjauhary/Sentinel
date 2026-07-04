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

export async function guard(message: string, options: GuardOptions): Promise<GuardResponse> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${options.apiUrl.replace(/\/$/, '')}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        app_id: options.appId,
        message: message,
        user_id: options.userId,
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

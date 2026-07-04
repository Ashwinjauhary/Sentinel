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
export declare class SentinelGuard {
    private options;
    constructor(options: GuardOptions);
    guard(message: string, userId?: string): Promise<GuardResponse>;
}

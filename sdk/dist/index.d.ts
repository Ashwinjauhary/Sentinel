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
export declare function guard(message: string, options: GuardOptions): Promise<GuardResponse>;

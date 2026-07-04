export interface GuardOptions {
    apiUrl: string;
    appId: string;
    apiKey: string;
    userId?: string;
}
export interface GuardResponse {
    allowed: boolean;
    score: number;
    reasons: string[];
}
export declare function guard(message: string, options: GuardOptions): Promise<GuardResponse>;

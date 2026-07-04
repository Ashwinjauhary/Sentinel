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
exports.guard = guard;
const DEFAULT_TIMEOUT_MS = 5000;
function guard(message, options) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const timeoutMs = (_a = options.timeoutMs) !== null && _a !== void 0 ? _a : DEFAULT_TIMEOUT_MS;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = yield fetch(`${options.apiUrl.replace(/\/$/, '')}/analyze`, {
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
            const data = yield response.json();
            return {
                allowed: (_b = data.allowed) !== null && _b !== void 0 ? _b : false,
                score: (_c = data.score) !== null && _c !== void 0 ? _c : 100,
                reasons: (_d = data.reasons) !== null && _d !== void 0 ? _d : ['API Error: Invalid response format'],
            };
        }
        catch (error) {
            clearTimeout(timeoutId);
            console.error("Sentinel Guard error:", error);
            // Fail-open: allow if API is down to not block legitimate users, but flag it.
            return {
                allowed: true,
                score: 0,
                reasons: [],
            };
        }
    });
}

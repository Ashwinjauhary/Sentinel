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
function guard(message, options) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
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
            });
            if (!response.ok) {
                throw new Error(`Sentinel API returned status ${response.status}`);
            }
            const data = yield response.json();
            return {
                allowed: (_a = data.allowed) !== null && _a !== void 0 ? _a : false,
                score: (_b = data.score) !== null && _b !== void 0 ? _b : 100,
                reasons: (_c = data.reasons) !== null && _c !== void 0 ? _c : ['API Error: Invalid response format'],
            };
        }
        catch (error) {
            console.error("Sentinel Guard error:", error);
            // Fail-closed or fail-open? Security tools usually fail-closed or log-only.
            // Let's fail-open (allow) if API is down to not block legitimate users, but flag it.
            return {
                allowed: true,
                score: 0,
                reasons: ['Error connecting to Sentinel API'],
            };
        }
    });
}

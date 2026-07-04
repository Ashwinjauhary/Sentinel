"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { ShieldAlert, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function LoginPage() {
  const [appId, setAppId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const { setAuth } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/apps/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: appId.trim(), api_key: apiKey.trim() }),
      });
      
      const data = await res.json();
      
      if (data.valid) {
        setAuth(appId.trim(), apiKey.trim(), data.name);
        router.push("/dashboard");
      } else {
        setError("Invalid App ID or API Key.");
      }
    } catch (err) {
      setError("Failed to connect to backend server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 selection:bg-zinc-800">
      <div className="w-full max-w-md bg-black border border-zinc-800 rounded-xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 mb-4">
            <ShieldAlert className="w-8 h-8 text-zinc-100" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Sentinel Login</h1>
          <p className="text-sm text-zinc-500 mt-2 text-center">
            Enter your App ID and API Key to access your telemetry dashboard.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">
              App ID
            </label>
            <input
              type="text"
              required
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-zinc-500 transition-colors"
              placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">
              API Key
            </label>
            <input
              type="password"
              required
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-zinc-500 transition-colors"
              placeholder="sk_live_..."
            />
          </div>

          <button
            type="submit"
            disabled={loading || !appId || !apiKey}
            className="w-full mt-4 bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 font-bold py-2.5 rounded-lg transition-colors flex justify-center items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "View Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ShieldAlert, Activity, Settings2, ShieldCheck, Zap, Server, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";

const API_URL = "http://localhost:8000";

type Incident = {
  id: string;
  created_at: string;
  message_excerpt: string;
  risk_score: number;
  reasons: string[];
  allowed: boolean;
};

export default function DashboardPage() {
  const { auth, logout } = useAuth();
  const router = useRouter();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<any>({ daily_scores: [], attack_type_counts: {} });
  const [threshold, setThreshold] = useState(70);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!auth.appId || !auth.apiKey) {
      router.push("/login");
      return;
    }

    const headers = {
      "Authorization": `Bearer ${auth.apiKey}`
    };

    // Fetch initial data
    fetch(`${API_URL}/incidents?app_id=${auth.appId}`, { headers })
      .then((res) => {
        if (res.status === 401) throw new Error("Unauthorized");
        return res.json();
      })
      .then((data) => setIncidents(data.incidents || []))
      .catch((err) => {
        console.error(err);
        if (err.message === "Unauthorized") logout();
      });

    fetch(`${API_URL}/stats?app_id=${auth.appId}&range=7d`, { headers })
      .then((res) => res.json())
      .then(setStats)
      .catch(console.error);

    // Socket connection
    const newSocket = io(API_URL, {
      query: { app_id: auth.appId },
    });

    newSocket.on("new_incident", (incident: Incident) => {
      setIncidents((prev) => [incident, ...prev].slice(0, 50));
    });

    setSocket(newSocket);
    return () => { newSocket.close(); };
  }, []);

  const handleThresholdChange = async (newVal: number) => {
    if (!auth.appId || !auth.apiKey) return;
    
    setThreshold(newVal);
    await fetch(`${API_URL}/apps/${auth.appId}/threshold`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${auth.apiKey}` },
      body: JSON.stringify({ threshold: newVal }),
    }).catch(console.error);
  };

  const chartData = Object.entries(stats.attack_type_counts || {}).map(([name, value]) => ({
    name: name.toUpperCase(),
    value,
  }));

  const blockedCount = incidents.filter(i => !i.allowed).length;
  const blockRate = incidents.length > 0 ? Math.round((blockedCount / incidents.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-black text-zinc-300 font-sans selection:bg-zinc-800 overflow-x-hidden relative">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Header */}
        <header className="flex justify-between items-center mb-12 pb-6 border-b border-zinc-900">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-zinc-900 rounded-lg border border-zinc-800">
              <ShieldAlert className="w-6 h-6 text-zinc-100" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                {auth.appName || "Sentinel"}
                <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] font-mono tracking-widest uppercase">Live</span>
              </h1>
              <p className="text-sm text-zinc-500 mt-1">App ID: <span className="font-mono text-zinc-400 text-xs">{auth.appId}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 px-4 py-2 rounded-md bg-black border border-zinc-800">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-medium text-zinc-300">Protected</span>
            </div>
            <button 
              onClick={logout}
              className="p-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="p-6 rounded-xl bg-black border border-zinc-800 hover:border-zinc-700 transition-colors flex items-center gap-5 group">
            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 group-hover:text-white transition-colors">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">Events Monitored</p>
              <h3 className="text-3xl font-bold text-white font-mono">{incidents.length}</h3>
            </div>
          </div>
          <div className="p-6 rounded-xl bg-black border border-zinc-800 hover:border-zinc-700 transition-colors flex items-center gap-5 group">
            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 group-hover:text-white transition-colors">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">Block Rate</p>
              <h3 className="text-3xl font-bold text-white font-mono">{blockRate}%</h3>
            </div>
          </div>
          <div className="p-6 rounded-xl bg-black border border-zinc-800 hover:border-zinc-700 transition-colors flex items-center gap-5 group">
            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 group-hover:text-white transition-colors">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">Latency Overhead</p>
              <h3 className="text-3xl font-bold text-white font-mono">42<span className="text-lg text-zinc-600 ml-1">ms</span></h3>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* Trend Chart */}
          <div className="lg:col-span-2 bg-black border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-zinc-400" /> 7-Day Risk Trajectory
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.daily_scores}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fafafa" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#fafafa" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="date" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "8px" }}
                    itemStyle={{ color: "#fff", fontWeight: "normal" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="avg_score"
                    stroke="#fafafa"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorScore)"
                    activeDot={{ r: 5, fill: "#fafafa", stroke: "#000", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Vectors & Threshold */}
          <div className="flex flex-col gap-6">
            <div className="flex-1 bg-black border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors">
              <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6">Threat Vectors</h2>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: "#18181b" }}
                      contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "8px" }}
                    />
                    <Bar dataKey="value" fill="#d4d4d8" radius={[0, 4, 4, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-black border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors relative overflow-hidden group">
              <div className="relative z-10">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-3.5 h-3.5 text-zinc-400" /> Security Threshold
                  </div>
                  <span className="text-white font-mono bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-xs">{threshold}</span>
                </h3>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={threshold}
                  onChange={(e) => handleThresholdChange(Number(e.target.value))}
                  className="w-full h-1 bg-zinc-900 border border-zinc-800 rounded-lg appearance-none cursor-pointer accent-white hover:accent-zinc-300 transition-all"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 mt-4 font-mono uppercase tracking-wider">
                  <span>Log (0-39)</span>
                  <span>Flag (40-69)</span>
                  <span className="text-zinc-300">Block (70+)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Feed Table */}
        <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Real-Time Inspection Log
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black text-zinc-500 font-mono text-[10px] uppercase tracking-widest border-b border-zinc-900">
                <tr>
                  <th className="px-6 py-4 font-medium">Timestamp</th>
                  <th className="px-6 py-4 font-medium">Score</th>
                  <th className="px-6 py-4 font-medium">Action</th>
                  <th className="px-6 py-4 font-medium">Message Payload Excerpt</th>
                  <th className="px-6 py-4 font-medium">Triggers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {incidents.map((inc) => (
                  <tr
                    key={inc.id}
                    className="hover:bg-zinc-900/50 transition-colors duration-200 group"
                  >
                    <td className="px-6 py-4 text-zinc-500 font-mono text-xs whitespace-nowrap group-hover:text-zinc-400 transition-colors">
                      {new Date(inc.created_at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-mono font-medium ${
                        inc.risk_score >= 70 ? 'text-rose-400' : 
                        inc.risk_score >= 40 ? 'text-amber-400' : 'text-zinc-400'
                      }`}>
                        {inc.risk_score.toString().padStart(3, '0')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {inc.allowed ? (
                        <div className="inline-flex items-center px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-400 text-[10px] font-medium tracking-wide uppercase">
                          Passed
                        </div>
                      ) : (
                        <div className="inline-flex items-center px-2 py-0.5 rounded border border-rose-900/50 bg-rose-950/30 text-rose-400 text-[10px] font-medium tracking-wide uppercase">
                          Blocked
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-400 max-w-md truncate font-mono text-xs group-hover:text-zinc-300 transition-colors">
                      <span className="opacity-30">"</span>{inc.message_excerpt}<span className="opacity-30">"</span>
                    </td>
                    <td className="px-6 py-4 text-[10px]">
                      <div className="flex flex-wrap gap-2">
                        {inc.reasons.map((r, i) => (
                          <span key={i} className="px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-400 font-mono tracking-wide uppercase">
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {incidents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-zinc-600 font-mono text-xs tracking-widest uppercase">
                      No telemetry data available. System awaiting inbound requests.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AlertTriangle, Shield, Activity, Settings } from "lucide-react";

const APP_ID = "00000000-0000-0000-0000-000000000000"; // Default demo UUID
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
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<any>({ daily_scores: [], attack_type_counts: {} });
  const [threshold, setThreshold] = useState(70);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Fetch initial data
    fetch(`${API_URL}/incidents?app_id=${APP_ID}`)
      .then((res) => res.json())
      .then((data) => setIncidents(data.incidents || []))
      .catch(console.error);

    fetch(`${API_URL}/stats?app_id=${APP_ID}&range=7d`)
      .then((res) => res.json())
      .then(setStats)
      .catch(console.error);

    // Socket connection
    const newSocket = io(API_URL, {
      query: { app_id: APP_ID },
    });

    newSocket.on("new_incident", (incident: Incident) => {
      setIncidents((prev) => [incident, ...prev].slice(0, 50));
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const handleThresholdChange = async (newVal: number) => {
    setThreshold(newVal);
    await fetch(`${API_URL}/apps/${APP_ID}/threshold`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threshold: newVal }),
    }).catch(console.error);
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-red-500";
    if (score >= 40) return "text-amber-500";
    return "text-emerald-500";
  };

  const chartData = Object.entries(stats.attack_type_counts || {}).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-gray-300 font-mono p-8 selection:bg-red-500/30">
      <header className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-red-500" />
          <h1 className="text-2xl font-bold tracking-tight text-gray-100">
            SENTINEL <span className="text-gray-600 font-normal">/</span> DASHBOARD
          </h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            System Active
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-[#121214] border border-gray-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4" /> 7-Day Risk Trend
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.daily_scores}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="date" stroke="#666" fontSize={12} />
                <YAxis stroke="#666" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
                  itemStyle={{ color: "#fff" }}
                />
                <Line
                  type="monotone"
                  dataKey="avg_score"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ fill: "#ef4444", r: 4 }}
                  activeDot={{ r: 6, fill: "#ef4444", stroke: "#000" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#121214] border border-gray-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Attack Vectors
          </h2>
          <div className="h-48 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                <XAxis type="number" stroke="#666" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="#666" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
                  cursor={{ fill: "#222" }}
                />
                <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-4 border-t border-gray-800">
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Settings className="w-3 h-3" /> Block Threshold ({threshold})
            </h3>
            <input
              type="range"
              min="0"
              max="100"
              value={threshold}
              onChange={(e) => handleThresholdChange(Number(e.target.value))}
              className="w-full accent-red-500 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-2">
              <span>Log (0-39)</span>
              <span>Flag (40-69)</span>
              <span>Block (70+)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#121214] border border-gray-800 rounded-lg overflow-hidden">
        <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-[#1a1a1c]">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Live Incident Feed
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#0f0f11] text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">Time</th>
                <th className="px-6 py-3 font-medium">Score</th>
                <th className="px-6 py-3 font-medium">Action</th>
                <th className="px-6 py-3 font-medium">Message Excerpt</th>
                <th className="px-6 py-3 font-medium">Detection Reasons</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {incidents.map((inc) => (
                <tr
                  key={inc.id}
                  className="hover:bg-[#1a1a1c] transition-colors duration-150 animate-in fade-in"
                >
                  <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                    {new Date(inc.created_at).toLocaleTimeString()}
                  </td>
                  <td className={`px-6 py-4 font-bold ${getScoreColor(inc.risk_score)}`}>
                    {inc.risk_score}
                  </td>
                  <td className="px-6 py-4">
                    {inc.allowed ? (
                      <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded text-xs">
                        PASSED
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-red-500/10 text-red-500 rounded text-xs">
                        BLOCKED
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-300 max-w-md truncate">
                    "{inc.message_excerpt}"
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-400">
                    <div className="flex flex-wrap gap-1">
                      {inc.reasons.map((r, i) => (
                        <span key={i} className="px-2 py-1 bg-gray-800 rounded">
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {incidents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-600">
                    No incidents recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

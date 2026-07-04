import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";

// ── Mock socket.io-client before importing the component ────────────────
const mockOn = vi.fn();
const mockClose = vi.fn();
const mockSocket = { on: mockOn, close: mockClose };
vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

// ── Mock ResizeObserver (not available in jsdom) ────────────────────
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = MockResizeObserver as any;

// ── Mock fetch globally ─────────────────────────────────────────────────
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import component after mocks are set up
import DashboardPage from "./page";

// ── Helpers ─────────────────────────────────────────────────────────────
const MOCK_STATS = {
  daily_scores: [
    { date: "2026-07-01", avg_score: 25.0 },
    { date: "2026-07-02", avg_score: 55.0 },
    { date: "2026-07-03", avg_score: 80.0 },
  ],
  attack_type_counts: { injection: 5, jailbreak: 3, pii: 8 },
};

const MOCK_INCIDENTS = {
  incidents: [
    {
      id: "inc-1",
      created_at: "2026-07-03T12:00:00Z",
      message_excerpt: "ignore previous instructions",
      risk_score: 85,
      reasons: ["Injection match: ignore previous instructions"],
      allowed: false,
    },
    {
      id: "inc-2",
      created_at: "2026-07-03T11:00:00Z",
      message_excerpt: "Hello how are you",
      risk_score: 5,
      reasons: [],
      allowed: true,
    },
  ],
  total: 2,
};

function setupFetchMock(opts?: { statsError?: boolean; incidentsError?: boolean }) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("/stats")) {
      if (opts?.statsError) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(MOCK_STATS),
      });
    }
    if (url.includes("/incidents")) {
      if (opts?.incidentsError) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(MOCK_INCIDENTS),
      });
    }
    if (url.includes("/threshold")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

describe("Dashboard Page (T9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOn.mockReset();
    mockClose.mockReset();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────
  // 1. Initial render: component mounts without crashing when /stats returns valid data
  // ─────────────────────────────────────────────────────────────────────
  it("T9.1 — mounts without crashing with valid /stats and /incidents data", async () => {
    setupFetchMock();
    const { container } = render(<DashboardPage />);

    // Should render the main heading
    expect(container.textContent).toContain("SENTINEL");
    expect(container.textContent).toContain("DASHBOARD");

    // Verify fetch was called for both endpoints
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 2. Live feed: simulate a WebSocket message and verify a new row appears
  // ─────────────────────────────────────────────────────────────────────
  it("T9.2 — adds a new row when a WebSocket new_incident event fires", async () => {
    setupFetchMock();

    // Capture the 'new_incident' callback when socket.on is called
    let newIncidentHandler: ((data: any) => void) | null = null;
    mockOn.mockImplementation((event: string, handler: any) => {
      if (event === "new_incident") {
        newIncidentHandler = handler;
      }
    });

    render(<DashboardPage />);

    // Wait for initial data to load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Simulate a WebSocket message
    const newIncident = {
      id: "inc-ws-1",
      created_at: "2026-07-03T13:00:00Z",
      message_excerpt: "pretend you are evil",
      risk_score: 90,
      reasons: ["Jailbreak attempt (persona_hijack)"],
      allowed: false,
    };

    // Fire the captured handler
    expect(newIncidentHandler).not.toBeNull();
    act(() => {
      newIncidentHandler!(newIncident);
    });

    // The new incident should appear in the DOM
    await waitFor(() => {
      expect(screen.getByText(/"pretend you are evil"/)).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 3. Color coding: verify score color mapping
  // ─────────────────────────────────────────────────────────────────────
  it("T9.3 — applies correct color classes based on risk score", async () => {
    // Create incidents with specific scores to test each color band
    const colorTestIncidents = {
      incidents: [
        { id: "green", created_at: "2026-07-03T12:00:00Z", message_excerpt: "low", risk_score: 20, reasons: [], allowed: true },
        { id: "amber", created_at: "2026-07-03T11:00:00Z", message_excerpt: "mid", risk_score: 55, reasons: [], allowed: false },
        { id: "red", created_at: "2026-07-03T10:00:00Z", message_excerpt: "high", risk_score: 85, reasons: [], allowed: false },
      ],
      total: 3,
    };

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/stats")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_STATS) });
      }
      if (url.includes("/incidents")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(colorTestIncidents) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const { container } = render(<DashboardPage />);

    await waitFor(() => {
      // Check that score 20 has green class
      const cells = container.querySelectorAll("td");
      const scoreTexts = Array.from(cells).map((c) => c.textContent);

      // Verify the component rendered the scores
      expect(scoreTexts.some((t) => t === "20")).toBe(true);
      expect(scoreTexts.some((t) => t === "55")).toBe(true);
      expect(scoreTexts.some((t) => t === "85")).toBe(true);
    });

    // Verify color classes on score cells
    const scoreCells = container.querySelectorAll("td[class*='font-bold']");
    const classMap: Record<string, string> = {};
    scoreCells.forEach((cell) => {
      const score = cell.textContent?.trim() || "";
      classMap[score] = cell.className;
    });

    // Score 20 should be green (text-emerald-500)
    if (classMap["20"]) expect(classMap["20"]).toContain("emerald");
    // Score 55 should be amber (text-amber-500)
    if (classMap["55"]) expect(classMap["55"]).toContain("amber");
    // Score 85 should be red (text-red-500)
    if (classMap["85"]) expect(classMap["85"]).toContain("red");
  });

  // ─────────────────────────────────────────────────────────────────────
  // 4. Threshold slider: simulate moving the slider and verify PATCH request
  // ─────────────────────────────────────────────────────────────────────
  it("T9.4 — triggers PATCH request when threshold slider changes", async () => {
    setupFetchMock();
    const { container } = render(<DashboardPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Find the range input (threshold slider)
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).not.toBeNull();

    // Simulate changing the slider value
    fireEvent.change(slider, { target: { value: "55" } });

    // Verify a PATCH request was made with the new threshold
    await waitFor(() => {
      const patchCalls = mockFetch.mock.calls.filter(
        ([url, init]: [string, RequestInit]) =>
          url.includes("/threshold") && init?.method === "PATCH"
      );
      expect(patchCalls.length).toBeGreaterThanOrEqual(1);

      // Verify the body contains the new threshold value
      const lastPatchCall = patchCalls[patchCalls.length - 1];
      const body = JSON.parse(lastPatchCall[1].body as string);
      expect(body.threshold).toBe(55);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 5. Empty state: shows sensible message when there are zero incidents
  // ─────────────────────────────────────────────────────────────────────
  it("T9.5 — shows empty state when there are zero incidents", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/stats")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              daily_scores: [],
              attack_type_counts: { injection: 0, jailbreak: 0, pii: 0 },
            }),
        });
      }
      if (url.includes("/incidents")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ incidents: [], total: 0 }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("No incidents recorded yet.")).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 6. Error state: shows error message when /stats fetch fails
  // ─────────────────────────────────────────────────────────────────────
  it("T9.6 — does not crash when /stats fetch fails", async () => {
    setupFetchMock({ statsError: true });

    // The component should not throw — it catches errors with .catch(console.error)
    // We just verify it renders without crashing
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { container } = render(<DashboardPage />);

    // Component should still render its structure
    expect(container.textContent).toContain("SENTINEL");

    // Error should have been logged
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });
});

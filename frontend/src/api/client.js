// Every call to the backend lives here. Shapes follow docs/api.md.
// While VITE_USE_MOCKS is not "false", reports come from the mock files instead of the backend.
// Upload, jobs and live always talk to the real backend.
import sessionReport from "../mocks/session_report.json";
import summaryWeek from "../mocks/summary_week.json";
import { buildFrames } from "../mocks/frames";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== "false";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}
const json = (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// ---- Mock state: remembers which moments were reviewed, so every screen agrees.
const reviewed = new Map();
const mockEvents = () => sessionReport.events.map((e) => ({ ...e, reviewed: reviewed.get(e.id) ?? e.reviewed }));
const mockSession = () => ({ ...sessionReport, events: mockEvents() });
let mockFrames = null;

// Screens that show counts (like the navbar badge) listen here to refresh after a review.
const listeners = new Set();
export function onReviewsChanged(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
const notify = () => listeners.forEach((cb) => cb());

// ---- Setup
export const getChildren = () => request("/children");
export const createChild = (child) => request("/children", json("POST", child));
export const updateChild = (id, changes) => request(`/children/${id}`, json("PATCH", changes));
export const getZones = () => request("/zones");
export const createZone = (zone) => request("/zones", json("POST", zone));
export const deleteZone = (id) => request(`/zones/${id}`, { method: "DELETE" });

// ---- Upload + processing
export function analyzeVideo(file, sessionDate) {
  const form = new FormData();
  form.append("video", file);
  if (sessionDate) form.append("session_date", sessionDate);
  return request("/analyze", { method: "POST", body: form });
}
export const getJob = (jobId) => request(`/jobs/${jobId}`);

// ---- Reports
export const getSession = (id) => (USE_MOCKS ? Promise.resolve(mockSession()) : request(`/sessions/${id}`));

export function getFrames(id) {
  if (!USE_MOCKS) return request(`/sessions/${id}/frames`);
  mockFrames ??= buildFrames(sessionReport);
  return Promise.resolve(mockFrames);
}

// Mock month: the mock week repeated back in time with small changes, marked as demo data.
function mockSummary(range) {
  if (range !== "month") return summaryWeek;
  const end = new Date(`${summaryWeek.end_date}T12:00:00`);
  const days = Array.from({ length: end.getDate() }, (_, i) => {
    const base = summaryWeek.days[i % summaryWeek.days.length];
    const date = new Date(end);
    date.setDate(end.getDate() - i);
    const wobble = 0.8 + ((i * 37) % 9) / 20;
    const weekend = [5, 6].includes(date.getDay());
    const scale = (v) => Math.round(v * wobble * (weekend ? 1.25 : 1));
    return {
      ...base,
      date: date.toISOString().slice(0, 10),
      tv_s: scale(base.tv_s),
      tablet_s: scale(base.tablet_s),
      phone_s: scale(base.phone_s),
      multi_screen_s: scale(base.multi_screen_s),
      active_s: Math.round(base.active_s * (weekend ? 0.7 : wobble)),
      alerts: (i * 7) % 5 === 0 ? 2 : (i * 3) % 4 === 0 ? 1 : 0,
      is_demo_data: i > 0,
    };
  });
  return { ...summaryWeek, range: "month", start_date: days.at(-1).date, days };
}

export const getSummary = ({ range = "week", childId, endDate } = {}) =>
  USE_MOCKS
    ? Promise.resolve(mockSummary(range))
    : request(`/summary?range=${range}${childId ? `&child_id=${childId}` : ""}${endDate ? `&end_date=${endDate}` : ""}`);

export const getAlerts = (range = "week") =>
  USE_MOCKS
    ? Promise.resolve(mockEvents().map((e) => ({ ...e, session_id: sessionReport.id, date: sessionReport.date })))
    : request(`/alerts?range=${range}`);

export async function markAlertReviewed(id, value = true) {
  let result;
  if (USE_MOCKS) {
    reviewed.set(id, value);
    result = mockEvents().find((e) => e.id === id);
  } else {
    result = await request(`/alerts/${id}`, json("PATCH", { reviewed: value }));
  }
  notify();
  return result;
}

// ---- Live
export const startLive = (children) => request("/live/start", json("POST", { children }));
export const stopLive = (sessionId) => request(`/live/${sessionId}/stop`, { method: "POST" });
export const liveSocketUrl = (sessionId) => `${API_URL.replace(/^http/, "ws")}/live/${sessionId}`;

// ---- Insights
export const askInsights = (question, childId) => request("/insights/ask", json("POST", { question, child_id: childId }));

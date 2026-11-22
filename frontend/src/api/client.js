// Every call to the backend lives here. Shapes follow docs/api.md.
// While USE_MOCKS is true, the app runs on the mock files without a backend.
import sessionReport from "../mocks/session_report.json";
import summaryWeek from "../mocks/summary_week.json";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== "false";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export const getChildren = () => request("/children");
export const createChild = (child) =>
  request("/children", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(child) });

export const getZones = () => request("/zones");
export const createZone = (zone) =>
  request("/zones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(zone) });

export function analyzeVideo(file, sessionDate) {
  const form = new FormData();
  form.append("video", file);
  if (sessionDate) form.append("session_date", sessionDate);
  return request("/analyze", { method: "POST", body: form });
}
export const getJob = (jobId) => request(`/jobs/${jobId}`);

export const getSession = (id) => (USE_MOCKS ? Promise.resolve(sessionReport) : request(`/sessions/${id}`));
export const getFrames = (id) => request(`/sessions/${id}/frames`);
export const getSummary = ({ range = "week", childId, endDate } = {}) =>
  USE_MOCKS
    ? Promise.resolve(summaryWeek)
    : request(`/summary?range=${range}${childId ? `&child_id=${childId}` : ""}${endDate ? `&end_date=${endDate}` : ""}`);

export const getAlerts = (range = "week") => request(`/alerts?range=${range}`);
export const markAlertReviewed = (id) =>
  request(`/alerts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewed: true }) });

export const askInsights = (question, childId) =>
  request("/insights/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, child_id: childId }) });

export const liveSocketUrl = (sessionId) => `${API_URL.replace("http", "ws")}/live/${sessionId}`;

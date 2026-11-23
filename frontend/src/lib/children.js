// Each child has a color, used only for identity (avatar, page tint, video boxes), never for data.
import { useEffect, useState } from "react";

export const CHILD_COLORS = [
  { color: "#7B5CC6", tint: "#ECE5FA", onDark: "#B9A6E8" },
  { color: "#B5508C", tint: "#F7E3EE", onDark: "#E7A3C6" },
  { color: "#9A6B3F", tint: "#F3E8DC", onDark: "#D9B48C" },
  { color: "#5C6B7A", tint: "#E6EAEE", onDark: "#AAB6C2" },
  { color: "#3F7A5A", tint: "#E2EFE7", onDark: "#94C9AB" },
];

// Colors picked on this device win, then the color saved on the child, then one by position.
const COLOR_KEY = "kanaf.colors";
const listeners = new Set();
function readOverrides() {
  try {
    return JSON.parse(localStorage.getItem(COLOR_KEY) || "{}");
  } catch {
    return {};
  }
}
export function rememberColor(childId, color) {
  try {
    localStorage.setItem(COLOR_KEY, JSON.stringify({ ...readOverrides(), [childId]: color }));
  } catch {
    /* not remembered in private mode */
  }
  listeners.forEach((cb) => cb());
}
export function useColorVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const cb = () => setV((x) => x + 1);
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, []);
  return v;
}

export function childTheme(children, childId) {
  const index = Math.max(0, children.findIndex((c) => c.id === childId));
  const saved = (readOverrides()[childId] ?? children[index]?.color)?.toLowerCase();
  return CHILD_COLORS.find((c) => c.color.toLowerCase() === saved) ?? CHILD_COLORS[index % CHILD_COLORS.length];
}

// The selected child is shared by Today, Week, Month and the profile.
const CHILD_KEY = "kanaf.child";
export function useSelectedChild(children) {
  const [id, setId] = useState(() => {
    try {
      return localStorage.getItem(CHILD_KEY);
    } catch {
      return null;
    }
  });
  const child = children.find((c) => c.id === id) ?? children[0] ?? null;
  const select = (next) => {
    setId(next);
    try {
      localStorage.setItem(CHILD_KEY, next);
    } catch {
      /* fine */
    }
  };
  return [child, select];
}

// What severity an event gets: "alert" means check now, "look" means worth a look.
export function severity(event) {
  if (event.reviewed) return "ok";
  return event.type === "danger_zone" ? "look" : "alert";
}

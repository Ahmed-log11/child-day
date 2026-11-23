// Draws what the system saw on top of a video or camera: boxes, body outlines and labels.
// Coordinates come in 0–1 (docs/api.md), so it works at any size.
import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/I18nProvider";

// COCO keypoint pairs that make a skeleton.
const BONES = [
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10], [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

export function OverlayCanvas({ frame, colorFor, nameFor, showBoxes = true, showOutlines = true, className = "" }) {
  const ref = useRef(null);
  const { t, dir } = useI18n();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const { width, height } = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (!frame) return;

    ctx.font = "600 12px 'Readex Pro', system-ui, sans-serif";
    ctx.direction = dir;
    const X = (v) => v * width;
    const Y = (v) => v * height;

    const label = (text, x, y, bg, fg) => {
      const w = ctx.measureText(text).width + 14;
      roundRect(ctx, x, y - 22, w, 20, 5);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.fillStyle = fg;
      ctx.textAlign = dir === "rtl" ? "right" : "left";
      ctx.fillText(text, dir === "rtl" ? x + w - 7 : x + 7, y - 8);
    };

    if (showBoxes) {
      for (const obj of frame.objects ?? []) {
        const [x1, y1, x2, y2] = obj.box;
        ctx.strokeStyle = obj.label === "tv" ? (obj.on ? "#7E9BD1" : "#5B6474") : "#F2C14E";
        ctx.lineWidth = 2;
        roundRect(ctx, X(x1), Y(y1), X(x2 - x1), Y(y2 - y1), 4);
        ctx.stroke();
        if (obj.label === "tv") label(t(obj.on ? "overlay.tvOn" : "overlay.tvOff"), X(x1), Y(y1), "#2F4F86", "#FFFFFF");
      }
    }

    for (const person of frame.people ?? []) {
      const color = colorFor(person.child_id);
      const [x1, y1, x2, y2] = person.box;
      if (showOutlines && person.keypoints?.length === 17) {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        for (const [a, b] of BONES) {
          const pa = person.keypoints[a];
          const pb = person.keypoints[b];
          if (pa[2] < 0.3 || pb[2] < 0.3) continue;
          ctx.beginPath();
          ctx.moveTo(X(pa[0]), Y(pa[1]));
          ctx.lineTo(X(pb[0]), Y(pb[1]));
          ctx.stroke();
        }
        const nose = person.keypoints[0];
        ctx.beginPath();
        ctx.arc(X(nose[0]), Y(nose[1]), Math.max(6, X(x2 - x1) * 0.09), 0, Math.PI * 2);
        ctx.stroke();
      }
      if (showBoxes) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        roundRect(ctx, X(x1), Y(y1), X(x2 - x1), Y(y2 - y1), 8);
        ctx.stroke();
        const name = nameFor(person.child_id) ?? `#${person.track_id}`;
        const state = person.screen && person.screen !== "none" ? t(`screen.${person.screen}`) : t(`activity.${person.activity}`);
        label(`${name} · ${state}`, X(x1), Y(y1), color, "#1C1A26");
      }
    }
  }, [frame, colorFor, nameFor, showBoxes, showOutlines, t, dir]);

  return <canvas ref={ref} className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden="true" />;
}

// A simple room drawn behind the overlays when there is no real video yet (mock mode).
export function MockRoom() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 160 90" preserveAspectRatio="none" aria-hidden="true">
      <rect width="160" height="90" fill="#23262E" />
      <rect y="56" width="160" height="34" fill="#2B2F38" />
      <rect x="6" y="12" width="37" height="30" rx="1" fill="#1B1D23" stroke="#3A3F4B" strokeWidth="0.6" />
      <rect x="8" y="58" width="50" height="16" rx="4" fill="#3A342F" />
      <rect x="118" y="22" width="30" height="40" rx="1" fill="#262A33" />
    </svg>
  );
}

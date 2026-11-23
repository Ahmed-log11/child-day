// Builds overlay frames (boxes + 17 body keypoints) from the mock session report,
// in the "Frame overlays" format of docs/api.md. Only used while VITE_USE_MOCKS is on.

// Stick-figure joints in a 100 x 140 box, per pose.
const POSES = {
  stand: { h: [50, 18], sl: [38, 34], sr: [62, 34], el: [33, 56], er: [67, 56], wl: [31, 76], wr: [69, 76], hl: [43, 78], hr: [57, 78], kl: [42, 104], kr: [58, 104], al: [41, 132], ar: [59, 132] },
  sit: { h: [50, 44], sl: [39, 60], sr: [61, 60], el: [34, 80], er: [66, 80], wl: [42, 94], wr: [58, 94], hl: [43, 100], hr: [57, 100], kl: [24, 108], kr: [76, 108], al: [46, 124], ar: [54, 124] },
  tablet: { h: [50, 48], sl: [39, 62], sr: [61, 62], el: [35, 82], er: [65, 82], wl: [46, 88], wr: [54, 88], hl: [43, 100], hr: [57, 100], kl: [24, 108], kr: [76, 108], al: [46, 124], ar: [54, 124] },
  run: { h: [46, 16], sl: [38, 32], sr: [58, 32], el: [28, 48], er: [70, 22], wl: [24, 64], wr: [78, 10], hl: [44, 74], hr: [54, 74], kl: [32, 96], kr: [68, 90], al: [38, 126], ar: [84, 108] },
};

function poseFor(screen, activity) {
  if (activity === "active") return "run";
  if (screen === "tablet" || screen === "phone" || screen === "multi_screen") return "tablet";
  if (screen === "tv" || activity === "still") return "sit";
  return "stand";
}

// COCO order: nose, eyes, ears, shoulders, elbows, wrists, hips, knees, ankles.
function keypoints(pose, box) {
  const p = POSES[pose];
  const [x1, y1, x2, y2] = box;
  const at = ([x, y]) => [+(x1 + (x / 100) * (x2 - x1)).toFixed(4), +(y1 + (y / 140) * (y2 - y1)).toFixed(4), 0.95];
  const [hx, hy] = p.h;
  return [
    at([hx, hy]), at([hx - 3, hy - 2]), at([hx + 3, hy - 2]), at([hx - 7, hy]), at([hx + 7, hy]),
    at(p.sl), at(p.sr), at(p.el), at(p.er), at(p.wl), at(p.wr),
    at(p.hl), at(p.hr), at(p.kl), at(p.kr), at(p.al), at(p.ar),
  ];
}

function stateAt(segments, childId, category, t) {
  return segments.find((s) => s.child_id === childId && s.category === category && s.start_s <= t && t < s.end_s)?.state;
}

export function buildFrames(report, fps = 1) {
  const frames = [];
  const homes = { c1: 0.36, c2: 0.58 };
  const tvBox = [0.04, 0.14, 0.27, 0.46];
  for (let t = 0; t <= report.video.duration_s; t += 1 / fps) {
    const people = [];
    const objects = [];
    let tvOn = false;
    report.children.forEach((child, i) => {
      const screen = stateAt(report.segments, child.id, "screen", t) ?? "none";
      const activity = stateAt(report.segments, child.id, "activity", t) ?? "still";
      if (screen === "tv" || screen === "multi_screen") tvOn = true;
      const drift = activity === "active" ? Math.sin(t / 4 + i) * 0.12 : Math.sin(t / 40 + i) * 0.01;
      const x = (homes[child.id] ?? 0.3 + i * 0.2) + drift;
      const box = [x, 0.3, x + 0.14, 0.9].map((v) => +v.toFixed(4));
      const trackId = child.track_ids?.[0] ?? i + 1;
      people.push({
        track_id: trackId,
        child_id: child.id,
        box,
        keypoints: keypoints(poseFor(screen, activity), box),
        screen,
        activity,
      });
      if (screen === "tablet" || screen === "multi_screen") {
        objects.push({ label: "tablet", box: [x + 0.045, 0.58, x + 0.095, 0.66], held_by: trackId });
      }
      if (screen === "phone") {
        objects.push({ label: "cell phone", box: [x + 0.055, 0.6, x + 0.085, 0.65], held_by: trackId });
      }
    });
    objects.unshift({ label: "tv", box: tvBox, on: tvOn });
    frames.push({ t: +t.toFixed(2), people, objects });
  }
  return { analyzed_fps: fps, frames };
}

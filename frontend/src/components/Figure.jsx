// Stick figures drawn from body keypoints, the same way the pose model sees a child.
const POSES = {
  stand: { h: [50, 18], sl: [38, 34], sr: [62, 34], el: [33, 56], er: [67, 56], wl: [31, 76], wr: [69, 76], hl: [43, 78], hr: [57, 78], kl: [42, 104], kr: [58, 104], al: [41, 132], ar: [59, 132] },
  sit: { h: [50, 44], sl: [39, 60], sr: [61, 60], el: [34, 80], er: [66, 80], wl: [42, 94], wr: [58, 94], hl: [43, 100], hr: [57, 100], kl: [24, 108], kr: [76, 108], al: [46, 124], ar: [54, 124] },
  tablet: { h: [50, 48], sl: [39, 62], sr: [61, 62], el: [35, 82], er: [65, 82], wl: [46, 88], wr: [54, 88], hl: [43, 100], hr: [57, 100], kl: [24, 108], kr: [76, 108], al: [46, 124], ar: [54, 124] },
  lie: { h: [14, 108], sl: [28, 102], sr: [28, 118], el: [40, 96], er: [42, 124], wl: [52, 94], wr: [54, 128], hl: [62, 104], hr: [62, 116], kl: [80, 102], kr: [80, 118], al: [98, 104], ar: [98, 116] },
  run: { h: [46, 16], sl: [38, 32], sr: [58, 32], el: [28, 48], er: [70, 22], wl: [24, 64], wr: [78, 10], hl: [44, 74], hr: [54, 74], kl: [32, 96], kr: [68, 90], al: [38, 126], ar: [84, 108] },
};
const BONES = [["sl", "sr"], ["sl", "el"], ["el", "wl"], ["sr", "er"], ["er", "wr"], ["hl", "hr"], ["hl", "kl"], ["kl", "al"], ["hr", "kr"], ["kr", "ar"]];
const JOINTS = ["el", "er", "wl", "wr", "kl", "kr", "al", "ar"];

export function Figure({ pose = "stand", color = "#1C2430", width = 70, title }) {
  const p = POSES[pose] ?? POSES.stand;
  const mid = (a, b) => [(p[a][0] + p[b][0]) / 2, (p[a][1] + p[b][1]) / 2];
  const [sx, sy] = mid("sl", "sr");
  const [hx, hy] = mid("hl", "hr");
  return (
    <svg
      width={width}
      height={(width * 140) / 100}
      viewBox="0 0 100 140"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
    >
      <g fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx={p.h[0]} cy={p.h[1]} r="9" />
        <line x1={sx} y1={sy} x2={hx} y2={hy} />
        {BONES.map(([a, b]) => (
          <line key={a + b} x1={p[a][0]} y1={p[a][1]} x2={p[b][0]} y2={p[b][1]} />
        ))}
        {JOINTS.map((j) => (
          <circle key={j} cx={p[j][0]} cy={p[j][1]} r="2.4" fill={color} stroke="none" />
        ))}
        {pose === "tablet" && <rect x="42" y="80" width="16" height="11" rx="2" fill="#2F4F86" stroke="none" />}
      </g>
    </svg>
  );
}

// Which figure fits a screen state + activity state.
export function poseFor(screen, activity) {
  if (activity === "active") return "run";
  if (screen === "tablet" || screen === "phone" || screen === "multi_screen") return "tablet";
  if (screen === "tv" || activity === "still") return "sit";
  return "stand";
}

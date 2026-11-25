// One moment of the video with what the system saw drawn on top, in the "viewfinder" look.
// Used by the Today timeline (paused at the dragged second) and by the review player.
import { useEffect, useRef } from "react";
import { MockRoom, OverlayCanvas } from "./OverlayCanvas";

export function frameAt(frames, second) {
  const list = frames?.frames ?? [];
  if (!list.length) return null;
  let best = list[0];
  for (const f of list) {
    if (f.t <= second) best = f;
    else break;
  }
  return best;
}

// Corner marks, like a camera viewfinder.
export function Hud() {
  return (
    <span className="pointer-events-none absolute inset-3 z-[2]" aria-hidden="true">
      {["top-0 left-0 border-t-[1.5px] border-l-[1.5px]", "top-0 right-0 border-t-[1.5px] border-r-[1.5px]", "bottom-0 left-0 border-b-[1.5px] border-l-[1.5px]", "bottom-0 right-0 border-b-[1.5px] border-r-[1.5px]"].map((c) => (
        <b key={c} className={`absolute size-[15px] border-[rgba(255,248,240,.85)] ${c}`} />
      ))}
    </span>
  );
}

export function FrameView({
  videoUrl,
  frames,
  second,
  colorFor,
  nameFor,
  showBoxes = true,
  showOutlines = true,
  stamp,
  videoRef,
  follow = true,
  className = "",
  onLoadedMetadata,
}) {
  const ownRef = useRef(null);
  const ref = videoRef ?? ownRef;

  // Paused mode: keep the video on the dragged second.
  useEffect(() => {
    const video = ref.current;
    if (!follow || !video || !videoUrl) return;
    if (Math.abs(video.currentTime - second) > 0.2) video.currentTime = second;
  }, [second, follow, videoUrl, ref]);

  return (
    <div className={`relative aspect-video overflow-hidden rounded-[20px] bg-[#2b221e] ${className}`}>
      {videoUrl ? (
        <video
          ref={ref}
          src={videoUrl}
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={(e) => {
            e.currentTarget.currentTime = second;
            onLoadedMetadata?.(e);
          }}
        />
      ) : (
        <MockRoom />
      )}
      <OverlayCanvas frame={frameAt(frames, second)} colorFor={colorFor} nameFor={nameFor} showBoxes={showBoxes} showOutlines={showOutlines} />
      <Hud />
      {stamp && (
        <span className="absolute start-3.5 bottom-3.5 z-[3] rounded-md bg-black/55 px-2.5 py-0.5 font-mono text-xs text-white tabular-nums">
          {stamp}
        </span>
      )}
    </div>
  );
}

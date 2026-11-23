// Getting one still frame of the room, from a video file or from the camera.
import { useEffect, useState } from "react";

export function useFirstFrame(file) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (!file) return setSrc(null);
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.src = url;
    const grab = () => {
      setSrc(snapshot(video));
      URL.revokeObjectURL(url);
    };
    video.addEventListener("loadeddata", () => (video.currentTime = Math.min(0.5, video.duration / 2 || 0)), { once: true });
    video.addEventListener("seeked", grab, { once: true });
    video.addEventListener("error", () => URL.revokeObjectURL(url), { once: true });
  }, [file]);
  return src;
}

export function snapshot(video, width = 960) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round((width * (video.videoHeight || 9)) / (video.videoWidth || 16));
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

// Live mode: webcam frames go to the backend over a WebSocket a few times per second,
// and the boxes and outlines come back to be drawn on top. Stop turns it into a normal session.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { getSession, liveSocketUrl, startLive, stopLive, USE_MOCKS, getChildren } from "../api/client";
import { useData } from "../lib/useData";
import { childTheme } from "../lib/children";
import { duration } from "../lib/format";
import { Card } from "../components/Card";
import { Avatar } from "../components/ChildSwitch";
import { OverlayCanvas } from "../components/OverlayCanvas";

const SEND_EVERY_MS = 400; // about 2.5 frames per second

export default function Live() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const socketRef = useRef(null);
  const timerRef = useRef(null);
  const startRef = useRef(0);
  const [status, setStatus] = useState("idle"); // idle | starting | running | stopping
  const [sessionId, setSessionId] = useState(null);
  const [frame, setFrame] = useState(null);
  const [problem, setProblem] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [flagged, setFlagged] = useState([]); // moments flagged during this live session

  const { data: children } = useData(() => (USE_MOCKS ? getSession("s1").then((s) => s.children) : getChildren()), []);
  const list = children ?? [];
  const colorFor = useCallback((id) => childTheme(list, id).onDark, [list]);
  const nameFor = useCallback((id) => list.find((c) => c.id === id)?.name, [list]);

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    socketRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    socketRef.current = null;
    streamRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  async function start() {
    setProblem(null);
    setFlagged([]);
    setStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    } catch (err) {
      setProblem(t("live.cameraError", { msg: err.message }));
      setStatus("idle");
      return;
    }
    try {
      const { session_id } = await startLive(list.map((c) => c.id));
      setSessionId(session_id);
      const socket = new WebSocket(liveSocketUrl(session_id));
      socketRef.current = socket;
      socket.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        setFrame(data.frame);
        if (data.alerts?.length) setFlagged((prev) => [...data.alerts, ...prev]);
      };
      socket.onerror = () => setProblem(t("live.socketError"));
      socket.onopen = () => {
        startRef.current = performance.now();
        setStatus("running");
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 360;
        timerRef.current = setInterval(() => {
          if (socket.readyState !== WebSocket.OPEN) return;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const image = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
          const tSec = (performance.now() - startRef.current) / 1000;
          setElapsed(tSec);
          socket.send(JSON.stringify({ t: +tSec.toFixed(2), image }));
        }, SEND_EVERY_MS);
      };
    } catch (err) {
      cleanup();
      setProblem(t("live.socketError") + ` (${err.message})`);
      setStatus("idle");
    }
  }

  async function stop() {
    setStatus("stopping");
    cleanup();
    try {
      if (sessionId) await stopLive(sessionId);
    } finally {
      navigate("/dashboard");
    }
  }

  const people = frame?.people ?? [];
  const running = status === "running";

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pt-7 sm:px-6 sm:pt-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {t("live.title")}
            {running && (
              <span className="flex items-center gap-1.5 rounded-full bg-alert-soft px-2.5 py-1 text-xs font-semibold text-alert-text">
                <span className="size-2 animate-pulse rounded-full bg-alert" />
                {t("live.badge")}
              </span>
            )}
          </h1>
          <p className="mt-2 max-w-2xl text-body">{t("live.intro")}</p>
        </div>
        {running || status === "stopping" ? (
          <button type="button" onClick={stop} disabled={status === "stopping"} className="flex min-h-12 items-center gap-2 rounded-xl bg-ink px-5 font-semibold text-white">
            <span className="size-2.5 rounded-sm bg-paper" />
            {status === "stopping" ? t("live.stopping") : t("live.stop")}
          </button>
        ) : (
          <button type="button" onClick={start} disabled={status === "starting"} className="flex min-h-12 items-center gap-2 rounded-full bg-clay px-5 font-semibold text-white hover:bg-rust disabled:opacity-70">
            <span className="size-2.5 rounded-full bg-paper" />
            {status === "starting" ? t("live.starting") : t("live.start")}
          </button>
        )}
      </div>

      {problem && (
        <p role="alert" className="rounded-xl bg-alert-soft p-3.5 text-sm text-alert-text">
          {problem}
        </p>
      )}

      <div className="flex flex-col gap-5 lg:flex-row">
        <section className="min-w-0 flex-[2] rounded-[22px] bg-peach p-3 sm:p-4">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#2b221e]">
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
            <OverlayCanvas frame={frame} colorFor={colorFor} nameFor={nameFor} />
            {status === "idle" && (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-[#E8DCD0]">{t("live.camera")}</div>
            )}
            {running && (
              <span className="absolute start-3 bottom-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">
                <span className="size-2 rounded-full bg-alert" />
                {t("live.since", { time: duration(t, elapsed) })}
              </span>
            )}
          </div>
        </section>

        <aside className="flex min-w-0 flex-1 flex-col gap-3.5">
          {flagged.map((a) => (
            <div key={a.id} role="status" className="flex items-center gap-3 rounded-[18px] bg-alert-soft px-4 py-3 text-alert-text">
              <span className="size-2.5 shrink-0 rounded-full bg-alert" />
              <span className="font-semibold">{t(`event.${a.type}`)}</span>
              <span className="ms-auto text-sm">{nameFor(a.child_id) ?? ""}</span>
            </div>
          ))}
          {running && people.length === 0 && <Card className="!p-5 text-body">{frame ? t("live.nobody") : t("live.waiting")}</Card>}
          {people.map((p) => {
            const child = list.find((c) => c.id === p.child_id);
            const theme = childTheme(list, p.child_id);
            return (
              <div key={p.track_id} className="overflow-hidden rounded-[22px] border border-[rgba(28,23,20,.1)] bg-paper">
                <div className="flex items-center gap-3 px-5 pt-4 pb-2" style={{ background: `linear-gradient(180deg, ${theme.tint}, #fff)` }}>
                  {child && <Avatar name={child.name} theme={theme} size={40} />}
                  <div className="text-lg font-bold">{child?.name ?? `#${p.track_id}`}</div>
                </div>
                <div className="px-5 pb-4 text-xl font-bold">
                  {t("now.sentence", { screen: t(`now.${p.screen}`), activity: t(`now.${p.activity}`) })}
                </div>
              </div>
            );
          })}
          <p className="text-[13px] leading-relaxed text-muted">{t("live.recording")}</p>
        </aside>
      </div>
    </main>
  );
}

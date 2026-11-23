// Setup: the children (with their colors) and the spots to watch in the room.
// Always saved on the real backend: POST /children, PATCH /children/{id}, /zones.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { createChild, createZone, deleteZone, getChildren, getZones, updateChild } from "../api/client";
import { CHILD_COLORS, childTheme, rememberColor, useColorVersion } from "../lib/children";
import { snapshot, useFirstFrame } from "../lib/frames";
import { Card } from "../components/Card";
import { Avatar } from "../components/ChildSwitch";
import { ZoneDrawer } from "../components/ZoneDrawer";

function Steps({ active }) {
  const { tl } = useI18n();
  return (
    <ol className="flex flex-wrap items-center gap-2.5 text-sm">
      {tl("setup.steps").map((label, i) => (
        <li key={label} className={`flex items-center gap-2 ${i <= active ? "font-semibold" : "text-muted"}`}>
          <span className={`flex size-7 items-center justify-center rounded-full text-[13px] ${i <= active ? "bg-sun text-ink" : "border-[1.5px] border-[#cdbfae]"}`}>{i + 1}</span>
          {label}
          {i < 2 && <span className="text-[#cdbfae]" aria-hidden="true">—</span>}
        </li>
      ))}
    </ol>
  );
}

function Swatches({ value, onPick, label }) {
  return (
    <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label={label}>
      {CHILD_COLORS.map((c) => {
        const on = c.color === value;
        return (
          <button
            key={c.color}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={c.color}
            onClick={() => onPick(c.color)}
            className="size-9 rounded-[10px]"
            style={{ background: c.color, boxShadow: on ? `0 0 0 3px #fff, 0 0 0 5px ${c.color}` : "none" }}
          />
        );
      })}
    </div>
  );
}

export default function Setup() {
  const { t } = useI18n();
  useColorVersion();
  const [children, setChildren] = useState([]);
  const [zones, setZones] = useState([]);
  const [offline, setOffline] = useState(null);
  const [name, setName] = useState("");
  const [age, setAge] = useState("5-12");
  const [color, setColor] = useState(CHILD_COLORS[0].color);
  const [problem, setProblem] = useState(null);
  const [adding, setAdding] = useState(false);

  // Frame of the room, from a video file or the camera.
  const [file, setFile] = useState(null);
  const fromVideo = useFirstFrame(file);
  const [cameraFrame, setCameraFrame] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frame = cameraFrame ?? fromVideo;

  useEffect(() => {
    Promise.all([getChildren(), getZones()])
      .then(([c, z]) => {
        setChildren(c);
        setZones(z);
        setColor(CHILD_COLORS[c.length % CHILD_COLORS.length].color);
      })
      .catch((err) => setOffline(err.message));
    return () => streamRef.current?.getTracks().forEach((tr) => tr.stop());
  }, []);

  async function addChild() {
    if (!name.trim()) return setProblem(t("setup.needName"));
    setAdding(true);
    setProblem(null);
    try {
      const child = await createChild({ name: name.trim(), age_group: age, color });
      const next = [...children, child];
      setChildren(next);
      setName("");
      setColor(CHILD_COLORS[next.length % CHILD_COLORS.length].color);
    } catch (err) {
      setProblem(t("setup.error", { msg: err.message }));
    } finally {
      setAdding(false);
    }
  }

  async function recolor(child, value) {
    rememberColor(child.id, value);
    setChildren((list) => list.map((c) => (c.id === child.id ? { ...c, color: value } : c)));
    try {
      await updateChild(child.id, { color: value });
    } catch {
      /* kept on this device */
    }
  }

  async function openCamera() {
    setCameraFrame(null);
    setFile(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      });
    } catch (err) {
      setProblem(t("setup.cameraError", { msg: err.message }));
    }
  }

  function takePhoto() {
    setCameraFrame(snapshot(videoRef.current));
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    setCameraOn(false);
  }

  const step = zones.length ? 2 : children.length ? 1 : 0;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 px-4 pt-7 sm:px-6 sm:pt-9">
      <Steps active={step} />
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("setup.title")}</h1>
        <p className="mt-2 max-w-2xl text-body">{t("setup.intro")}</p>
      </div>
      {offline && (
        <p role="alert" className="rounded-xl bg-alert-soft p-3.5 text-sm text-alert-text">
          {t("setup.offline", { msg: offline })}
        </p>
      )}

      <Card>
        <h2 className="text-xl font-bold">{t("setup.children")}</h2>
        <p className="mt-1 mb-5 text-sm text-muted">{t("setup.childrenNote")}</p>
        <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
          {children.map((c) => {
            const theme = childTheme(children, c.id);
            return (
              <div key={c.id} className="overflow-hidden rounded-[20px] border border-line bg-white">
                <div className="flex items-center gap-3.5 px-5 pt-5 pb-3" style={{ background: `linear-gradient(180deg, ${theme.tint}, #fff)` }}>
                  <Avatar name={c.name} theme={theme} size={52} />
                  <div>
                    <div className="text-xl font-bold">{c.name}</div>
                    <div className="text-sm text-muted">{t(`child.ages.${c.age_group}`)}</div>
                  </div>
                </div>
                <div className="px-5 pb-5">
                  <div className="mb-2.5 text-[13px] text-muted">{t("setup.colorOf", { name: c.name })}</div>
                  <Swatches value={theme.color} onPick={(v) => recolor(c, v)} label={t("setup.colorOf", { name: c.name })} />
                </div>
              </div>
            );
          })}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addChild();
            }}
            className="flex flex-col gap-3 rounded-[20px] border-[1.5px] border-dashed border-[#d3c7b8] p-5"
          >
            {!children.length && <p className="text-sm text-body">{t("setup.noChildren")}</p>}
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              {t("setup.name")}
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setProblem(null);
                }}
                placeholder={t("setup.namePlaceholder")}
                className="min-h-11 rounded-xl border border-[#ded5ca] bg-white px-3 font-normal"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              {t("setup.age")}
              <select value={age} onChange={(e) => setAge(e.target.value)} className="min-h-11 rounded-xl border border-[#ded5ca] bg-white px-3 font-normal">
                <option value="3-4">{t("child.ages.3-4")}</option>
                <option value="5-12">{t("child.ages.5-12")}</option>
              </select>
            </label>
            <Swatches value={color} onPick={setColor} label={t("child.color")} />
            <button type="submit" disabled={adding} className="min-h-11 rounded-xl border border-[#ded5ca] bg-white font-semibold hover:border-clay disabled:opacity-70">
              {adding ? t("setup.adding") : t("setup.add")}
            </button>
            {problem && (
              <p role="alert" className="text-sm text-alert-text">
                {problem}
              </p>
            )}
          </form>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-bold">{t("setup.zones")}</h2>
        <p className="mt-1 mb-5 text-sm text-muted">{t("setup.zonesNote")}</p>
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <span className="text-sm font-semibold">{t("setup.from")}</span>
          <label className="flex min-h-11 cursor-pointer items-center rounded-xl border border-[#ded5ca] bg-white px-4 text-sm font-semibold hover:border-clay">
            {t("setup.fromVideo")}
            <input
              type="file"
              accept="video/*"
              className="sr-only"
              onChange={(e) => {
                setCameraFrame(null);
                setFile(e.target.files?.[0] ?? null);
              }}
            />
          </label>
          <button type="button" onClick={openCamera} className="min-h-11 rounded-xl border border-[#ded5ca] bg-white px-4 text-sm font-semibold hover:border-clay">
            {t("setup.fromCamera")}
          </button>
        </div>

        {cameraOn && (
          <div className="mb-4 flex flex-col gap-3">
            <video ref={videoRef} muted playsInline className="aspect-video w-full rounded-2xl bg-[#23262E] object-cover" />
            <div className="flex gap-2.5">
              <button type="button" onClick={takePhoto} className="min-h-11 rounded-xl bg-clay px-4 text-sm font-semibold text-white">
                {t("setup.takePhoto")}
              </button>
              <button
                type="button"
                onClick={() => {
                  streamRef.current?.getTracks().forEach((tr) => tr.stop());
                  setCameraOn(false);
                }}
                className="min-h-11 rounded-xl border border-[#ded5ca] bg-white px-4 text-sm font-semibold"
              >
                {t("setup.cancel")}
              </button>
            </div>
          </div>
        )}

        {frame ? (
          <ZoneDrawer
            frame={frame}
            zones={zones}
            onSave={async (zone) => {
              const saved = await createZone(zone);
              setZones((list) => [...list, saved]);
            }}
          />
        ) : (
          !cameraOn && <p className="rounded-2xl bg-cream p-6 text-center text-sm text-body">{t("setup.noFrame")}</p>
        )}

        <ul className="mt-5 flex flex-col gap-2">
          {!zones.length && <li className="text-sm text-muted">{t("setup.noZones")}</li>}
          {zones.map((z) => (
            <li key={z.id} className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3">
              <span className="size-3.5 rounded-[3px] border-2 border-dashed border-look" />
              <span className="flex-1 font-semibold">{z.name}</span>
              <button
                type="button"
                onClick={async () => {
                  await deleteZone(z.id);
                  setZones((list) => list.filter((x) => x.id !== z.id));
                }}
                className="min-h-9 rounded-lg px-3 text-sm font-semibold text-alert-text hover:bg-alert-soft"
              >
                {t("setup.delete")}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex justify-end">
        <Link to="/upload" className="flex min-h-12 items-center rounded-xl bg-clay px-6 font-semibold text-white hover:bg-clay-dark">
          {t("setup.continue")}
        </Link>
      </div>
    </main>
  );
}

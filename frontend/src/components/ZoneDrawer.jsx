// Draw a zone on a still frame of the room: tap the corners, name it, save.
// Points are stored from 0 to 1, so the same zone fits uploads and live mode.
import { useState } from "react";
import { useI18n } from "../i18n/I18nProvider";

export function ZoneShapes({ zones, draft = [] }) {
  const pts = (poly) => poly.map(([x, y]) => `${x * 100},${y * 100}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      {zones.map((z) => (
        <polygon key={z.id} points={pts(z.polygon)} fill="rgba(217,150,26,0.18)" stroke="#D9961A" strokeWidth="0.5" strokeDasharray="1.5 1" vectorEffect="non-scaling-stroke" />
      ))}
      {draft.length > 0 && (
        <>
          <polygon points={pts(draft)} fill="rgba(242,193,78,0.25)" stroke="#F2C14E" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {draft.map(([x, y], i) => (
            <circle key={i} cx={x * 100} cy={y * 100} r="1.1" fill="#fff" stroke="#A9472A" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          ))}
        </>
      )}
    </svg>
  );
}

export function ZoneDrawer({ frame, zones, onSave }) {
  const { t } = useI18n();
  const [points, setPoints] = useState([]);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState(null);
  const [saving, setSaving] = useState(false);

  function addPoint(e) {
    const box = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    const y = (e.clientY - box.top) / box.height;
    setPoints((p) => [...p, [+x.toFixed(4), +y.toFixed(4)]]);
    setProblem(null);
  }

  async function save() {
    if (points.length < 3) return setProblem(t("setup.needPoints"));
    if (!name.trim()) return setProblem(t("setup.needZoneName"));
    setSaving(true);
    try {
      await onSave({ name: name.trim(), polygon: points });
      setPoints([]);
      setName("");
    } catch (err) {
      setProblem(t("setup.error", { msg: err.message }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-body">{t("setup.drawHint")}</p>
      <button
        type="button"
        onClick={addPoint}
        className="relative block aspect-video w-full cursor-crosshair overflow-hidden rounded-2xl bg-[#23262E]"
        aria-label={t("setup.drawHint")}
      >
        <img src={frame} alt="" className="h-full w-full object-cover" draggable="false" />
        <ZoneShapes zones={zones} draft={points} />
      </button>
      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm font-semibold">
          {t("setup.zoneName")}
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setProblem(null);
            }}
            placeholder={t("setup.zonePlaceholder")}
            className="min-h-11 rounded-xl border border-[#ded5ca] bg-white px-3 font-normal"
          />
        </label>
        <button type="button" onClick={() => setPoints((p) => p.slice(0, -1))} className="min-h-11 rounded-xl border border-[#ded5ca] bg-white px-3.5 text-sm font-semibold">
          {t("setup.undo")}
        </button>
        <button type="button" onClick={() => setPoints([])} className="min-h-11 rounded-xl border border-[#ded5ca] bg-white px-3.5 text-sm font-semibold">
          {t("setup.clear")}
        </button>
        <button type="button" onClick={save} disabled={saving} className="min-h-11 rounded-xl bg-clay px-4 text-sm font-semibold text-white disabled:opacity-70">
          {t("setup.saveZone")}
        </button>
      </div>
      {problem && (
        <p role="alert" className="text-sm text-alert-text">
          {problem}
        </p>
      )}
    </div>
  );
}

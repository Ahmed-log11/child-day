// Glass card, the building block of every screen.
export function Card({ className = "", children, ...rest }) {
  return (
    <section className={`glass rounded-[28px] p-5 sm:p-6 ${className}`} {...rest}>
      {children}
    </section>
  );
}

export function StatCard({ label, value, note, bar }) {
  return (
    <div className="glass rounded-[24px] p-5">
      <Stat label={label} value={value} note={note} bar={bar} />
    </div>
  );
}

// One number with its label, used inside StatRow.
export function Stat({ label, value, note, bar }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="text-[12.5px] text-muted">{label}</div>
      <div className="text-[26px] leading-tight font-extrabold tracking-tight text-ink sm:text-[30px]">{value}</div>
      {bar && (
        <div className={`h-[5px] overflow-hidden rounded-full ${bar.track}`}>
          <div className={`h-full rounded-full ${bar.fill}`} style={{ width: `${Math.min(100, bar.pct)}%` }} />
        </div>
      )}
      {note && <div className="text-[12.5px] text-muted">{note}</div>}
    </div>
  );
}

// Four numbers in one glass strip, split by thin lines.
export function StatRow({ items }) {
  return (
    <section className="glass grid grid-cols-2 rounded-[28px] p-2 lg:grid-cols-4">
      {items.map((it, i) => (
        <div
          key={i}
          className={`px-4 py-4 sm:px-5 ${i % 2 ? "border-s border-[rgba(28,23,20,.1)]" : ""} ${i >= 2 ? "border-t border-[rgba(28,23,20,.1)] lg:border-t-0" : ""} ${i === 2 ? "lg:border-s" : ""}`}
        >
          <Stat {...it} />
        </div>
      ))}
    </section>
  );
}

export function Card({ className = "", children, ...rest }) {
  return (
    <section className={`rounded-[20px] border border-line bg-white p-5 sm:p-7 ${className}`} {...rest}>
      {children}
    </section>
  );
}

export function StatCard({ label, value, note, bar }) {
  return (
    <div className="rounded-[20px] border border-line bg-white p-5 sm:p-6">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1.5 text-3xl font-bold tracking-tight sm:text-4xl">{value}</div>
      {bar && (
        <div className={`mt-3 h-2 rounded-full ${bar.track}`}>
          <div className={`h-2 rounded-full ${bar.fill}`} style={{ width: `${Math.min(100, bar.pct)}%` }} />
        </div>
      )}
      {note && <div className="mt-2 text-[13px] text-body">{note}</div>}
    </div>
  );
}

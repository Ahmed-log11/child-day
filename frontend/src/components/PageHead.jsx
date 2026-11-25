// The top of a screen: small date line, big title, optional links, and tools on the other side.
export function PageHead({ eyebrow, title, sub, links, tools }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mono mb-2 text-muted">{eyebrow}</div>}
        <h1 className="text-[clamp(34px,5vw,58px)] leading-[1.15] font-extrabold tracking-tight">{title}</h1>
        {sub && <p className="mt-2 max-w-[62ch] text-body">{sub}</p>}
        {links && <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">{links}</div>}
      </div>
      {tools && <div className="flex flex-wrap items-center gap-2.5">{tools}</div>}
    </div>
  );
}

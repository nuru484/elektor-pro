// Card heading that carries a status tag.
//
// The tag sits BESIDE the name while they both fit on one line, and drops to
// its own line only when the name is long enough that they cannot share one.
//
// That is what `flex-wrap` gives for free, as long as the title keeps its
// content-based hypothetical size: a short name leaves room, so the tag stays
// on the line and `justify-between` pushes it right; a long name's natural
// width overflows the row, so the tag wraps below and the name then has the
// full width to wrap into. No measuring, no breakpoint guessing - it responds
// to the actual text at the actual width.
//
// Why it matters: the old always-side-by-side version left the tag floating
// next to line one of a three-line name, detached from everything under it.
export function CardTitleRow({
  meta,
  tag,
  title,
  titleClassName = "text-base font-medium",
}: {
  /** Optional extra text next to the tag (dates, ballot numbers). */
  meta?: React.ReactNode;
  tag?: React.ReactNode;
  title: React.ReactNode;
  titleClassName?: string;
}) {
  return (
    <div className="min-w-0">
      {meta && <div className="mb-1 flex flex-wrap gap-x-2">{meta}</div>}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
        <p className={`min-w-0 [overflow-wrap:anywhere] ${titleClassName}`}>
          {title}
        </p>
        {tag && <span className="shrink-0">{tag}</span>}
      </div>
    </div>
  );
}

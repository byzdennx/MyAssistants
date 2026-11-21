import { cx } from '../lib/utils';

// Ilustrasi garis minimalis: tempat tinta & pena bulu.
export function InkwellIllustration({ className }) {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx('text-ink-soft', className)}
      aria-hidden="true"
    >
      <path d="M50 100h60l5-32H45z" />
      <path d="M62 68v-9h36v9" />
      <ellipse cx="80" cy="59" rx="18" ry="3.5" />
      <path d="M38 100h84" />
      <path d="M99 56C111 40 126 24 143 11c-2 19-12 35-31 45" />
      <path d="M99 56L88 71" />
      <path d="M109 46c6-2 12-6 16-12M117 37c4-1 8-4 11-8" opacity="0.7" />
      <path d="M18 109h28M114 109h28" strokeDasharray="1 4" opacity="0.7" />
      <circle cx="82" cy="82" r="1.8" fill="var(--terracotta)" stroke="none" />
    </svg>
  );
}

export default function EmptyState({ title, body, hint, quote, className }) {
  return (
    <div className={cx('fade-slide mx-auto flex max-w-md flex-col items-center px-4 py-10 text-center', className)}>
      <InkwellIllustration className="h-28 w-40" />
      <h2 className="mt-6 font-display text-[1.9rem] italic leading-tight letterpress">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{body}</p>
      {hint && <div className="mt-5 text-sm text-ink-soft">{hint}</div>}
      {quote && (
        <p className="mt-8 border-t-[3px] border-double border-rule pt-4 font-serif text-xs italic leading-relaxed text-ink-faint">
          {quote}
        </p>
      )}
    </div>
  );
}

import { cx } from '../lib/utils';

// Garis ganda tipis. `ornament` (✦ atau ❧) — pakai sangat jarang, maksimal satu per section.
export default function VintageDivider({ ornament, className }) {
  if (!ornament) return <div role="separator" className={cx('rule-double w-full', className)} />;
  return (
    <div role="separator" className={cx('flex items-center gap-4', className)}>
      <span className="rule-double flex-1" />
      <span aria-hidden="true" className="font-serif text-sm leading-none text-terracotta">
        {ornament}
      </span>
      <span className="rule-double flex-1" />
    </div>
  );
}

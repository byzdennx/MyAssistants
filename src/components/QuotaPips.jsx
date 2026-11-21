import { cx } from '../lib/utils';

// Lima kotak kecil seperti tanda hitung: terisi = sisa kuota.
export default function QuotaPips({ remaining, limit = 24, className }) {
  return (
    <span className={cx('inline-flex items-center gap-[3px]', className)} aria-hidden="true">
      {Array.from({ length: limit }, (_, i) => (
        <span
          key={i}
          className={cx(
            'h-2.5 w-2.5 rounded-[1px] border transition-colors duration-200',
            i < remaining ? 'border-ink bg-ink' : 'border-rule-strong bg-transparent',
          )}
        />
      ))}
    </span>
  );
}

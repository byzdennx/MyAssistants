import { cx } from '../lib/utils';

// Kartu kaca "engraved": blur kuat, tepi atas terang, tepi bawah gelap.
// Radius sengaja kecil (6px) — bukan bubbly.
export default function GlassCard({ as: Tag = 'div', strong = false, className, children, ...rest }) {
  return (
    <Tag className={cx(strong ? 'glass-hi' : 'glass', 'rounded-md', className)} {...rest}>
      {children}
    </Tag>
  );
}

import { Link } from '../router';
import { Icon } from './icons';
import QuotaPips from './QuotaPips';
import VintageDivider from './VintageDivider';
import { useT } from '../lib/i18n';
import { useOnline, useQuota } from '../lib/hooks';
import { cx } from '../lib/utils';

const NAV = [
  { seg: '', to: '/', key: 'nav.home', icon: 'home' },
  { seg: 'chat', to: '/chat', key: 'nav.chat', icon: 'chat' },
  { seg: 'coder', to: '/coder', key: 'nav.coder', icon: 'code' },
  { seg: 'vision', to: '/vision', key: 'nav.vision', icon: 'eye' },
  { seg: 'files', to: '/files', key: 'nav.files', icon: 'folder' },
  { seg: 'profile', to: '/profile', key: 'nav.profile', icon: 'user' },
];

// Latar: poster cetak lawas yang statis. Bentuknya tegas supaya kaca punya sesuatu untuk di-blur.
function Backdrop({ dim = false }) {
  return (
    <div className="backdrop" data-dim={dim} aria-hidden="true">
      <div className="bd-hatch" />
      <div className="bd-arch" />
      <div className="bd-disc" />
      <div className="bd-sun" />
      <div className="bd-rule" />
    </div>
  );
}

function Header({ route }) {
  const t = useT();
  const quota = useQuota();
  const current = route.segments[0] || '';

  return (
    <header className="glass-bar relative z-30 shrink-0 border-b-[3px] border-double border-rule-strong">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-5 px-5 sm:px-8">
        <Link to="/" className="flex items-baseline gap-2 leading-none" aria-label="MyAssistants">
          <span className="font-display text-[1.7rem] tracking-[-0.01em] letterpress">
            My<em className="text-accent">Assistants</em>
          </span>
        </Link>
        <span className="hidden font-serif text-xs italic text-ink-faint xl:inline">{t('brand.tagline')}</span>

        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label={t('nav.main')}>
          {NAV.map((item) => {
            const active = current === item.seg;
            return (
              <Link
                key={item.seg}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'px-3 py-1.5 text-[0.86rem] transition-colors duration-200',
                  active
                    ? 'font-medium text-ink underline decoration-double decoration-terracotta decoration-[3px] underline-offset-[7px]'
                    : 'text-ink-soft hover:text-ink',
                )}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        <div
          className="ml-auto flex items-center gap-2 md:ml-3 md:border-l md:border-rule md:pl-4"
          title={t('quota.left', { n: quota.remaining, limit: quota.limit })}
        >
          <QuotaPips remaining={quota.remaining} limit={quota.limit} />
          <span className="font-mono text-[0.72rem] tabular-nums text-ink-soft">
            {quota.remaining}/{quota.limit}
          </span>
        </div>
      </div>
    </header>
  );
}

function MobileTabs({ route }) {
  const t = useT();
  const current = route.segments[0] || '';
  return (
    <nav
      className="glass-bar fixed inset-x-0 bottom-0 z-40 grid h-14 grid-cols-6 border-t-[3px] border-double border-rule-strong md:hidden"
      aria-label={t('nav.main')}
    >
      {NAV.map((item) => {
        const active = current === item.seg;
        return (
          <Link
            key={item.seg}
            to={item.to}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'relative flex flex-col items-center justify-center gap-0.5 text-[0.66rem] tracking-wide transition-colors duration-200',
              active ? 'text-ink' : 'text-ink-faint',
            )}
          >
            {active && <span className="absolute inset-x-4 top-0 h-[2px] bg-terracotta" aria-hidden="true" />}
            <Icon name={item.icon} size={19} strokeWidth={active ? 1.9 : 1.5} />
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}

function Footer() {
  const t = useT();
  return (
    <footer className="mx-auto w-full max-w-6xl px-5 pb-24 pt-20 sm:px-8 md:pb-10">
      <VintageDivider />
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="font-serif text-[0.95rem] italic text-ink-soft">
          Crafted with care by <span className="text-accent">EpannXD</span> · © 2026
        </p>
        <p className="text-xs text-ink-faint">{t('footer.note')}</p>
      </div>
    </footer>
  );
}

export default function Layout({ route, fullHeight = false, children }) {
  const t = useT();
  const online = useOnline();

  return (
    <div className={cx('relative text-ink', fullHeight ? 'h-dvh overflow-hidden' : 'min-h-dvh')}>
      <Backdrop dim={fullHeight} />
      <div className={cx('relative z-10 flex flex-col', fullHeight ? 'h-full' : 'min-h-dvh')}>
        <Header route={route} />

        {!online && (
          <div
            role="alert"
            className="fade-slide flex shrink-0 items-center justify-center gap-2 border-b border-rule bg-[var(--kraft)] px-4 py-2 text-center text-xs text-[var(--kraft-ink)]"
          >
            <Icon name="wifi-off" size={14} />
            {t('offline.banner')}
          </div>
        )}

        <main className="relative flex-1">
          {fullHeight ? <div className="absolute inset-x-0 bottom-14 top-0 md:bottom-0">{children}</div> : children}
        </main>

        {!fullHeight && <Footer />}
      </div>
      <MobileTabs route={route} />
    </div>
  );
}

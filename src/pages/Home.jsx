import { useMemo } from 'react';
import GlassCard from '../components/GlassCard';
import VintageDivider from '../components/VintageDivider';
import QuotaPips from '../components/QuotaPips';
import { InkwellIllustration } from '../components/EmptyState';
import { Icon } from '../components/icons';
import { Link } from '../router';
import { useT, QUOTES } from '../lib/i18n';
import { useConversations, useFiles, useNow, useQuota, useStreak } from '../lib/hooks';
import { countFiles } from '../lib/files';
import { relativeTime } from '../lib/utils';

function slotFor(hour) {
  if (hour >= 4 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 15) return 'afternoon';
  if (hour >= 15 && hour < 18) return 'evening';
  return 'night';
}

function LedgerRow({ label, children }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <span className="leader" aria-hidden="true" />
      <dd className="font-display text-[2rem] leading-none tabular-nums text-ink letterpress">{children}</dd>
    </div>
  );
}

export default function Home() {
  const t = useT();
  const conversations = useConversations();
  const filesState = useFiles();
  const totalFiles = useMemo(() => countFiles(filesState), [filesState]);
  const streak = useStreak();
  const quota = useQuota();
  const now = useNow(60000);

  const slot = slotFor(new Date(now).getHours());
  const locale = t.lang === 'en' ? 'en-US' : 'id-ID';
  const dateLabel = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(now);

  const totalMessages = useMemo(() => conversations.reduce((n, c) => n + c.messages.length, 0), [conversations]);
  const recent = conversations.slice(0, 5);

  const quote = useMemo(() => {
    const quotes = QUOTES[t.lang] || QUOTES.id;
    return quotes[Math.floor(Date.now() / 86400000) % quotes.length];
  }, [t.lang]);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-x-16 gap-y-14 px-5 pb-6 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-12">
      {/* ── kiri: sapaan, aksi, percakapan terakhir ── */}
      <section className="lg:col-span-7" aria-labelledby="greeting">
        <p className="eyebrow">{dateLabel}</p>

        <h1
          id="greeting"
          className="mt-6 font-display text-[clamp(3rem,8.4vw,5.9rem)] leading-[0.92] tracking-[-0.025em] letterpress"
        >
          {t(`home.greeting.${slot}`)}
          <span className="mt-3 block text-[0.42em] italic leading-[1.12] tracking-[-0.005em] text-accent">
            {t(`home.lead.${slot}`)}
          </span>
        </h1>

        <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-4">
          <Link to="/chat" className="btn btn-ink px-5 py-2.5">
            <Icon name="plus" size={15} />
            {t('home.actions.newChat')}
          </Link>
          <Link to="/coder" className="btn btn-line px-5 py-2.5">
            <Icon name="code" size={15} />
            {t('home.actions.openCoder')}
          </Link>
          <Link to="/files" className="btn btn-quiet">
            <Icon name="folder" size={14} />
            {t('home.actions.files')}
          </Link>
          <Link to="/profile/settings" className="btn btn-quiet">
            <Icon name="sliders" size={14} />
            {t('home.actions.settings')}
          </Link>
        </div>

        <VintageDivider className="mt-14" />

        <div className="mt-9">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-serif text-xl italic text-ink">{t('home.recent.title')}</h2>
            <span className="eyebrow tabular-nums">{recent.length}/5</span>
          </div>

          {recent.length === 0 ? (
            <GlassCard className="mt-5 flex items-center gap-6 p-6">
              <InkwellIllustration className="h-20 w-28 shrink-0" />
              <div>
                <p className="font-display text-2xl italic leading-tight">{t('home.recent.empty.title')}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{t('home.recent.empty.body')}</p>
              </div>
            </GlassCard>
          ) : (
            <GlassCard as="ol" className="mt-5 divide-y divide-rule overflow-hidden">
              {recent.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/${c.mode}/${c.id}`}
                    className="group flex items-baseline gap-4 px-5 py-4 transition-colors duration-200 hover:bg-ink/[0.05]"
                  >
                    <span className="min-w-0 flex-1 truncate font-serif text-[1.02rem] text-ink">
                      {c.title || t('convo.untitled')}
                    </span>
                    <span className="eyebrow hidden shrink-0 sm:inline">{t(`mode.${c.mode}`)}</span>
                    <time
                      dateTime={new Date(c.updatedAt).toISOString()}
                      className="w-28 shrink-0 text-right font-mono text-[0.7rem] text-ink-faint"
                    >
                      {relativeTime(c.updatedAt, t.lang, now)}
                    </time>
                    <Icon
                      name="arrow-right"
                      size={14}
                      className="shrink-0 -translate-x-1 self-center text-ink-faint opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                    />
                  </Link>
                </li>
              ))}
            </GlassCard>
          )}
        </div>
      </section>

      {/* ── kanan: buku catatan (sengaja lebih rendah — layout tidak simetris) ── */}
      <aside className="lg:col-span-5 lg:pt-32" aria-label={t('home.ledger')}>
        <GlassCard strong className="p-7 sm:p-9">
          <h2 className="font-display text-[2.1rem] italic leading-none letterpress">{t('home.ledger')}</h2>

          <dl className="mt-8 space-y-5">
            <LedgerRow label={t('home.stat.chats')}>{conversations.length}</LedgerRow>
            <LedgerRow label={t('home.stat.messages')}>{totalMessages}</LedgerRow>
            <LedgerRow label={t('home.stat.files')}>{totalFiles}</LedgerRow>
            <LedgerRow label={t('home.stat.streak')}>{t('home.unit.days', { n: streak })}</LedgerRow>
            <LedgerRow label={t('home.stat.quota')}>
              <span className="inline-flex items-center gap-3">
                <QuotaPips remaining={quota.remaining} limit={quota.limit} className="translate-y-[-3px]" />
                <span>
                  {quota.remaining}
                  <span className="text-ink-faint">/{quota.limit}</span>
                </span>
              </span>
            </LedgerRow>
          </dl>

          <VintageDivider className="my-8" />

          <figure>
            <blockquote className="font-serif text-[1rem] italic leading-relaxed text-ink-soft">“{quote}”</blockquote>
            <figcaption className="eyebrow mt-4 flex items-center gap-2">
              <span aria-hidden="true" className="font-serif text-sm normal-case tracking-normal text-terracotta">
                ❧
              </span>
              {t('home.quote.label')}
            </figcaption>
          </figure>
        </GlassCard>
      </aside>
    </div>
  );
}

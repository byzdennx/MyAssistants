import { useId, useRef, useState } from 'react';
import GlassCard from '../components/GlassCard';
import VintageDivider from '../components/VintageDivider';
import { Icon } from '../components/icons';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { Link, navigate } from '../router';
import { useT } from '../lib/i18n';
import { useConversations, useSettings } from '../lib/hooks';
import {
  clearCache,
  deleteAllConversations,
  deleteEverything,
  getDeviceId,
  storageUsage,
  updateSettings,
} from '../lib/storage';
import { applyImport, exportAllToFile, readImportFile } from '../lib/exportImport';
import { resetQuota } from '../lib/rateLimit';
import { deleteAllFiles } from '../lib/files';
import { cx, formatBytes, isDevMode } from '../lib/utils';

const TABS = ['settings', 'manager', 'danger'];
const VERSION = '1.0.0';

/* ── potongan UI kecil ─────────────────────────────────────── */
function Row({ title, desc, children, stack = false, id }) {
  return (
    <div className={cx('flex gap-x-10 gap-y-3 py-6', stack ? 'flex-col' : 'flex-col sm:flex-row sm:items-center sm:justify-between')}>
      <div className="max-w-md">
        <h3 id={id} className="font-serif text-[1.02rem] leading-snug text-ink">
          {title}
        </h3>
        {desc && <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">{desc}</p>}
      </div>
      <div className={cx(stack ? 'w-full' : 'shrink-0')}>{children}</div>
    </div>
  );
}

function Seg({ value, options, onChange, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.swatch && (
            <span
              aria-hidden="true"
              className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[1px] border border-rule-strong align-middle"
              style={{ background: o.swatch }}
            />
          )}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, labelledBy }) {
  return <button type="button" role="switch" aria-checked={checked} aria-labelledby={labelledBy} className="switch" onClick={() => onChange(!checked)} />;
}

/* ── halaman ───────────────────────────────────────────────── */
export default function Profile({ route }) {
  const t = useT();
  const tab = TABS.includes(route.segments[1]) ? route.segments[1] : 'settings';
  const deviceId = getDeviceId();

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-x-16 gap-y-12 px-5 pb-6 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-12">
      {/* identitas */}
      <aside className="lg:col-span-4">
        <p className="eyebrow">{t('profile.title')}</p>
        <div className="mt-6 flex items-center gap-5">
          <div
            aria-hidden="true"
            className="grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center rounded-full bg-ink/5 font-display text-[2.8rem] italic leading-none text-ink shadow-[0_0_0_4px_var(--paper),0_0_0_5px_var(--rule-strong),inset_0_1px_0_var(--hl-top)]"
          >
            E
          </div>
          <div>
            <h1 className="font-display text-[2.6rem] leading-none tracking-[-0.01em] letterpress">EpannXD</h1>
            <p className="eyebrow mt-2.5">{t('profile.developer')}</p>
          </div>
        </div>

        <p className="mt-7 max-w-xs font-serif text-[0.98rem] italic leading-relaxed text-ink-soft">{t('profile.lead')}</p>

        <GlassCard className="mt-8 p-5">
          <dl className="space-y-3.5 text-sm">
            <div className="flex items-baseline gap-3">
              <dt className="text-ink-soft">{t('profile.device')}</dt>
              <span className="leader" aria-hidden="true" />
              <dd className="font-mono text-[0.72rem] text-ink" title={deviceId}>
                {deviceId.slice(0, 8)}…
              </dd>
            </div>
            <div className="flex items-baseline gap-3">
              <dt className="text-ink-soft">{t('profile.version')}</dt>
              <span className="leader" aria-hidden="true" />
              <dd className="font-mono text-[0.72rem] text-ink">{VERSION}</dd>
            </div>
          </dl>
          <p className="mt-4 border-t border-rule pt-4 text-xs leading-relaxed text-ink-faint">{t('profile.anonymous')}</p>
        </GlassCard>
      </aside>

      {/* tab + isi */}
      <section className="lg:col-span-8 lg:pt-8">
        <div role="tablist" aria-label={t('profile.tabs')} className="flex flex-wrap gap-x-8 gap-y-2 border-b-[3px] border-double border-rule-strong">
          {TABS.map((key) => {
            const active = tab === key;
            return (
              <Link
                key={key}
                to={`/profile/${key}`}
                role="tab"
                aria-selected={active}
                className={cx(
                  '-mb-[3px] border-b-[3px] border-double pb-3 pt-1 text-[0.95rem] transition-colors duration-200',
                  active ? 'border-terracotta font-medium text-ink' : 'border-transparent text-ink-faint hover:text-ink',
                  key === 'danger' && !active && 'hover:text-accent',
                )}
              >
                {t(`profile.tab.${key}`)}
              </Link>
            );
          })}
        </div>

        <div key={tab} className="fade-slide mt-8" role="tabpanel">
          {tab === 'settings' && <SettingsTab />}
          {tab === 'manager' && <ManagerTab />}
          {tab === 'danger' && <DangerTab />}
        </div>
      </section>
    </div>
  );
}

/* ── Settings ──────────────────────────────────────────────── */
function SettingsTab() {
  const t = useT();
  const s = useSettings();
  const animId = useId();
  const typeId = useId();

  return (
    <GlassCard className="divide-y divide-rule px-6 sm:px-8">
      <Row title={t('settings.theme')} desc={t('settings.theme.desc')}>
        <Seg
          label={t('settings.theme')}
          value={s.theme}
          onChange={(theme) => updateSettings({ theme })}
          options={[
            { value: 'light', label: t('theme.light'), swatch: '#F4EDE4' },
            { value: 'sepia', label: t('theme.sepia'), swatch: '#E6D7BB' },
            { value: 'dark', label: t('theme.dark'), swatch: '#18120D' },
          ]}
        />
      </Row>

      <Row title={t('settings.fontSize')} desc={t('settings.fontSize.desc')}>
        <Seg
          label={t('settings.fontSize')}
          value={s.fontSize}
          onChange={(fontSize) => updateSettings({ fontSize })}
          options={[
            { value: 'sm', label: t('fs.sm') },
            { value: 'md', label: t('fs.md') },
            { value: 'lg', label: t('fs.lg') },
          ]}
        />
      </Row>

      <Row title={t('settings.lang')} desc={t('settings.lang.desc')}>
        <select
          className="field w-44"
          value={s.lang}
          onChange={(e) => updateSettings({ lang: e.target.value })}
          aria-label={t('settings.lang')}
        >
          <option value="id">Bahasa Indonesia</option>
          <option value="en">English</option>
        </select>
      </Row>

      <Row id={animId} title={t('settings.animations')} desc={t('settings.animations.desc')}>
        <Toggle checked={s.animations} labelledBy={animId} onChange={(animations) => updateSettings({ animations })} />
      </Row>

      <Row id={typeId} title={t('settings.typewriter')} desc={t('settings.typewriter.desc')}>
        <Toggle checked={s.typewriter} labelledBy={typeId} onChange={(typewriter) => updateSettings({ typewriter })} />
      </Row>

      <Row title={t('settings.serverKeys')} desc={t('settings.serverKeys.desc')}>
      </Row>
    </GlassCard>
  );
}

/* ── Manager ───────────────────────────────────────────────── */
function ManagerTab() {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const settings = useSettings();
  useConversations(); // supaya angka penyimpanan ikut segar
  const dev = isDevMode();
  const fileRef = useRef(null);
  const [mode, setMode] = useState('merge');
  const [usage, setUsage] = useState(() => storageUsage());
  const mockId = useId();

  const onExport = () => {
    exportAllToFile();
    toast({ kind: 'success', message: t('manager.exportAll.done'), duration: 2600 });
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const res = await readImportFile(file);
    if (!res.ok) {
      toast({ kind: 'error', message: t('manager.import.invalid', { reason: t(`import.err.${res.code}`) }) });
      return;
    }
    const { conversations: c, messages: m, files: f } = res.summary;
    if (mode === 'replace') {
      const ok = await confirm({
        title: t('manager.import.confirm.title'),
        body: t('manager.import.confirm.body', { c, m }),
        confirmLabel: t('manager.import.confirm.yes'),
        tone: 'danger',
      });
      if (!ok) return;
    }
    applyImport(res.parsed, mode);
    setUsage(storageUsage());
    toast({ kind: 'success', message: t('manager.import.ok', { c, m, f }) });
  };

  const onClearCache = async () => {
    await clearCache();
    setUsage(storageUsage());
    toast({ kind: 'success', message: t('manager.cache.done'), duration: 2600 });
  };

  const onResetQuota = () => {
    resetQuota();
    toast({ kind: 'success', message: t('manager.dev.done'), duration: 2600 });
  };

  return (
    <GlassCard className="divide-y divide-rule px-6 sm:px-8">
      <Row title={t('manager.exportAll.title')} desc={t('manager.exportAll.desc')}>
        <button type="button" className="btn btn-ink" onClick={onExport}>
          <Icon name="download" size={15} />
          {t('manager.exportAll.btn')}
        </button>
      </Row>

      <Row title={t('manager.import.title')} desc={t('manager.import.desc')}>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <Seg
            label={t('manager.import.mode')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'merge', label: t('manager.import.merge') },
              { value: 'replace', label: t('manager.import.replace') },
            ]}
          />
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={onFile} tabIndex={-1} aria-hidden="true" />
          <button type="button" className="btn btn-line" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={15} />
            {t('manager.import.btn')}
          </button>
        </div>
      </Row>

      <Row title={t('manager.cache.title')} desc={t('manager.cache.desc')}>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <button type="button" className="btn btn-line" onClick={onClearCache}>
            {t('manager.cache.btn')}
          </button>
          <p className="font-mono text-[0.7rem] text-ink-faint">
            {t('manager.storage')}: {formatBytes(usage)}
          </p>
        </div>
      </Row>

      {dev && (
        <>
          <Row title={t('manager.dev.title')} desc={t('manager.dev.desc')}>
            <button type="button" className="btn btn-line" onClick={onResetQuota}>
              {t('manager.dev.btn')}
            </button>
          </Row>
          <Row id={mockId} title={t('manager.mock.title')} desc={t('manager.mock.desc')}>
            <Toggle checked={settings.devMock} labelledBy={mockId} onChange={(devMock) => updateSettings({ devMock })} />
          </Row>
        </>
      )}
    </GlassCard>
  );
}

/* ── Danger Zone ───────────────────────────────────────────── */
function DangerTab() {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();

  const ask = (titleKey) =>
    confirm({
      title: t(titleKey),
      body: t('danger.confirm.title'),
      confirmLabel: t('danger.confirm.yes'),
      requireText: 'DELETE',
      tone: 'danger',
    });

  const onDeleteConversations = async () => {
    if (!(await ask('danger.convos.title'))) return;
    deleteAllConversations();
    toast({ kind: 'info', message: t('danger.convos.done') });
  };

  const onDeleteFiles = async () => {
    if (!(await ask('danger.files.title'))) return;
    deleteAllFiles();
    toast({ kind: 'info', message: t('danger.files.done') });
  };

  const onFactoryReset = async () => {
    if (!(await ask('danger.reset.title'))) return;
    deleteEverything();
    navigate('/');
    toast({ kind: 'info', message: t('danger.reset.done') });
  };

  return (
    <div>
      <p className="mb-5 font-serif text-sm italic text-accent">{t('danger.lead')}</p>
      <GlassCard className="divide-y divide-rule px-6 sm:px-8">
        <Row title={t('danger.convos.title')} desc={t('danger.convos.desc')}>
          <button type="button" className="btn btn-terra" onClick={onDeleteConversations}>
            <Icon name="trash" size={15} />
            {t('danger.convos.btn')}
          </button>
        </Row>
        <Row title={t('danger.files.title')} desc={t('danger.files.desc')}>
          <button type="button" className="btn btn-terra" onClick={onDeleteFiles}>
            <Icon name="trash" size={15} />
            {t('danger.files.btn')}
          </button>
        </Row>
        <Row title={t('danger.reset.title')} desc={t('danger.reset.desc')}>
          <button type="button" className="btn btn-terra" onClick={onFactoryReset}>
            <Icon name="trash" size={15} />
            {t('danger.reset.btn')}
          </button>
        </Row>
      </GlassCard>
      <VintageDivider className="mt-10 opacity-60" />
    </div>
  );
}

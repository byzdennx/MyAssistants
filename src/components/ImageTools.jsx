// Alat gambar Nekolabs di halaman Vision: restore, enhance, hapus latar.
// Input berupa URL gambar https; request lewat /api/image (key di server).

import { useState } from 'react';
import GlassCard from './GlassCard';
import VintageDivider from './VintageDivider';
import { Icon } from './icons';
import { useToast } from './Toast';
import { useQuotaModal } from './QuotaModal';
import { useT } from '../lib/i18n';
import { describeError, runImageTool } from '../lib/api';
import { consumeQuota, getQuota, refundQuota } from '../lib/rateLimit';
import { IMAGE_TOOLS, UPSCALE_VALUES } from '../config/providers';
import { cx } from '../lib/utils';

// papan catur halus supaya area transparan (hasil hapus latar) terlihat
const CHECKER = {
  backgroundImage:
    'linear-gradient(45deg, var(--rule) 25%, transparent 25%, transparent 75%, var(--rule) 75%), linear-gradient(45deg, var(--rule) 25%, transparent 25%, transparent 75%, var(--rule) 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 8px 8px',
};

export default function ImageTools() {
  const t = useT();
  const toast = useToast();
  const { openQuota } = useQuotaModal();
  const [url, setUrl] = useState('');
  const [tool, setTool] = useState(IMAGE_TOOLS[0].id);
  const [upscale, setUpscale] = useState(UPSCALE_VALUES[0]);
  const [background, setBackground] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { source, url, requestId, tool }

  const def = IMAGE_TOOLS.find((x) => x.id === tool);
  const source = url.trim();
  const valid = /^https:\/\/\S+$/i.test(source);

  const run = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!valid) {
      toast({ kind: 'error', message: t('error.bad_image_url') });
      return;
    }
    if (!navigator.onLine) {
      toast({ kind: 'error', message: t('error.offline') });
      return;
    }
    if (!getQuota().canSend) {
      openQuota();
      return;
    }
    const stamp = consumeQuota();
    setBusy(true);
    try {
      const res = await runImageTool({ tool, url: source, upscale, background });
      setResult({ source, url: res.url, requestId: res.requestId, tool });
    } catch (err) {
      refundQuota(stamp);
      toast({ kind: 'error', message: describeError(t, err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid w-full max-w-5xl gap-x-10 gap-y-8 px-4 py-8 sm:px-6 lg:grid-cols-12">
        <form onSubmit={run} className="lg:col-span-5">
          <p className="eyebrow">{t('tools.title')}</p>
          <h2 className="mt-4 font-display text-[2.1rem] italic leading-[1.05] letterpress">{t('tools.lead')}</h2>

          <label htmlFor="tool-url" className="eyebrow mt-8 block">
            {t('tools.url')}
          </label>
          <input
            id="tool-url"
            type="url"
            inputMode="url"
            className="field mt-2.5 font-mono !text-[0.8rem]"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://contoh.com/foto.jpg"
            autoComplete="off"
            spellCheck={false}
          />

          <p className="eyebrow mt-6">{t('tools.tool')}</p>
          <div className="seg mt-2.5" role="group" aria-label={t('tools.tool')}>
            {IMAGE_TOOLS.map((x) => (
              <button key={x.id} type="button" aria-pressed={tool === x.id} onClick={() => setTool(x.id)}>
                {t(`tools.${x.id}`)}
              </button>
            ))}
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-ink-faint">{t(`tools.${tool}.desc`)}</p>

          {def.options.includes('upscale') && (
            <div className="mt-5 flex items-center justify-between gap-4">
              <span className="text-sm text-ink-soft">{t('tools.upscale')}</span>
              <div className="seg" role="group" aria-label={t('tools.upscale')}>
                {UPSCALE_VALUES.map((v) => (
                  <button key={v} type="button" aria-pressed={upscale === v} onClick={() => setUpscale(v)}>
                    {v}×
                  </button>
                ))}
              </div>
            </div>
          )}
          {def.options.includes('background') && (
            <div className="mt-4 flex items-center justify-between gap-4">
              <span id="tool-bg" className="text-sm text-ink-soft">
                {t('tools.background')}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={background}
                aria-labelledby="tool-bg"
                className="switch"
                onClick={() => setBackground((v) => !v)}
              />
            </div>
          )}

          <button type="submit" className="btn btn-ink mt-8 w-full py-2.5" disabled={busy || !valid}>
            <Icon name={busy ? 'refresh' : 'send'} size={14} />
            {busy ? t('tools.running') : t('tools.run')}
          </button>
        </form>

        <div className="lg:col-span-7 lg:pt-10">
          <GlassCard strong className="p-5 sm:p-6">
            {result ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <figure>
                    <figcaption className="eyebrow mb-2">{t('tools.before')}</figcaption>
                    <img src={result.source} alt={t('tools.before')} className="w-full rounded-sm border border-rule object-contain" />
                  </figure>
                  <figure>
                    <figcaption className="eyebrow mb-2">
                      {t('tools.after')} · {t(`tools.${result.tool}`)}
                    </figcaption>
                    <img
                      src={result.url}
                      alt={t('tools.after')}
                      className="w-full rounded-sm border border-rule object-contain"
                      style={result.tool === 'rembg' ? CHECKER : undefined}
                    />
                  </figure>
                </div>
                <VintageDivider className="my-5" />
                <div className="flex flex-wrap items-center gap-3">
                  <a href={result.url} target="_blank" rel="noopener noreferrer" download className="btn btn-line">
                    <Icon name="download" size={14} />
                    {t('tools.open')}
                  </a>
                  {result.requestId && (
                    <span className="font-mono text-[0.64rem] text-ink-faint">x-request-id: {result.requestId}</span>
                  )}
                </div>
              </>
            ) : (
              <p className={cx('py-14 text-center font-serif text-sm italic text-ink-faint', busy && 'opacity-60')}>
                {busy ? t('tools.running') : t('tools.empty')}
              </p>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

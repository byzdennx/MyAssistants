import { useEffect } from 'react';
import { Icon } from './icons';
import MarkdownView from './MarkdownView';
import { useToast } from './Toast';
import { useT } from '../lib/i18n';
import { useSettings } from '../lib/hooks';
import { useTypewriter } from '../lib/useTypewriter';
import { copyText, cx, formatBytes, formatTime } from '../lib/utils';
import { navigate } from '../router';

// User di kanan (tinta pekat), AI di kiri (kaca). Di Coder, bubble AI selebar kolom
// dan hanya menampilkan penjelasan + manifest file (kode hidup di File Manager).
export default function ChatBubble({ message, wide = false, mode = 'chat', canRegenerate = false, onRegenerate }) {
  const t = useT();
  if (message.role === 'user') {
    return (
      <article className="fade-slide flex flex-col items-end gap-1.5">
        <p className="eyebrow flex items-center gap-2 pr-0.5">
          <span>{t('convo.you')}</span>
          <time dateTime={new Date(message.ts).toISOString()}>{formatTime(message.ts, t.lang)}</time>
        </p>
        <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-md rounded-br-none bg-bubble-user px-4 py-3 text-[0.93rem] leading-relaxed text-bubble-ink shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_6px_14px_-8px_var(--shadow)] sm:max-w-[80%]">
          {message.content}
        </div>
      </article>
    );
  }
  return (
    <AssistantBubble
      message={message}
      wide={wide}
      mode={mode}
      canRegenerate={canRegenerate}
      onRegenerate={onRegenerate}
    />
  );
}

function AssistantBubble({ message, wide, mode, canRegenerate, onRegenerate }) {
  const t = useT();
  const toast = useToast();
  const settings = useSettings();
  // streaming: teks muncul apa adanya saat chunk masuk; typewriter hanya untuk pesan lokal
  const displayText = mode === 'coder' && typeof message.codeFree === 'string' ? message.codeFree : message.content;
  const typing = !message.streaming && message.local && settings.typewriter && settings.animations;
  const typed = useTypewriter(displayText, typing);
  const streaming = Boolean(message.streaming);
  const showManifest = mode === 'coder' && message.files?.length > 0 && !streaming && typed.done;
  const totalBytes = (message.files || []).reduce((n, f) => n + (f.bytes || 0), 0);

  const copy = async () => {
    const ok = await copyText(message.content);
    toast({ kind: ok ? 'success' : 'error', message: ok ? t('toast.copied') : t('toast.copyFailed'), duration: 2600 });
  };

  return (
    <article className="group fade-slide flex flex-col items-start gap-1.5">
      <p className="eyebrow flex items-center gap-2 pl-0.5">
        <span aria-hidden="true" className="inline-block h-1.5 w-1.5 bg-terracotta" />
        <span>MyAssistants</span>
        <time dateTime={new Date(message.ts).toISOString()}>{formatTime(message.ts, t.lang)}</time>
      </p>

      <div
        className={cx(
          'glass min-w-0 max-w-full rounded-md rounded-bl-none px-4 py-3.5 sm:px-5',
          wide ? 'w-full' : 'sm:max-w-[88%]',
        )}
      >
        {typed.text.trim() ? <MarkdownView text={typed.text} complete={typed.done} /> : null}
        {(streaming || !typed.done) && <span className="type-caret" aria-hidden="true" />}
        {showManifest && <FileManifest message={message} totalBytes={totalBytes} />}
      </div>

      <div className="flex items-center gap-0.5 pl-0.5 opacity-60 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100">
        <button type="button" className="btn btn-quiet" onClick={copy} aria-label={t('convo.copyResponse')} title={t('convo.copyResponse')}>
          <Icon name="copy" size={13} />
          <span className="hidden sm:inline">{t('common.copy')}</span>
        </button>
        {canRegenerate && !streaming && typed.done && (
          <button type="button" className="btn btn-quiet" onClick={onRegenerate} aria-label={t('convo.regenerate')} title={t('convo.regenerate')}>
            <Icon name="refresh" size={13} />
            <span className="hidden sm:inline">{t('convo.regenerate')}</span>
          </button>
        )}
        {!streaming && !typed.done && (
          <button type="button" className="btn btn-quiet" onClick={typed.skip}>
            {t('convo.skip')}
          </button>
        )}
      </div>
    </article>
  );
}

// Manifest file: daftar "✓ membuat file <path>" — kode hanya dibuka dari File Manager.
function FileManifest({ message, totalBytes }) {
  const t = useT();
  return (
    <div className="mt-3.5 border-t-[3px] border-double border-rule pt-3">
      <p className="eyebrow mb-2.5 flex items-center gap-2">
        <span aria-hidden="true" className="font-serif text-sm normal-case tracking-normal text-sage-ink">✓</span>
        {t('coder.manifest.title')}
        {message.filesProject && <span className="normal-case tracking-normal text-ink-faint">— {message.filesProject}</span>}
      </p>
      <ul className="space-y-1 font-mono text-[0.78rem]">
        {message.files.map((f) => (
          <li key={f.path} className="flex items-baseline gap-2">
            <span aria-hidden="true" className="text-sage-ink">✓</span>
            <span className="text-ink-soft">{t('coder.manifest.created')} </span>
            <span className="min-w-0 flex-1 truncate text-ink">{f.path}</span>
            <span className="shrink-0 text-[0.68rem] text-ink-faint">{formatBytes(f.bytes || 0)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="font-mono text-[0.66rem] text-ink-faint">
          {message.files.length} file · {formatBytes(totalBytes)}
        </span>
        <button type="button" className="btn btn-ink !px-3 !py-1 !text-[0.76rem]" onClick={() => navigate('/files')}>
          {t('coder.manifest.open')}
        </button>
      </div>
    </div>
  );
}

// Indikator "sedang menulis": tiga titik tinta yang menyala bergantian (tanpa membal).
export function ThinkingBubble({ wide = false }) {
  const t = useT();
  return (
    <article className="fade-in flex flex-col items-start gap-1.5" aria-live="polite">
      <p className="eyebrow flex items-center gap-2 pl-0.5">
        <span aria-hidden="true" className="inline-block h-1.5 w-1.5 bg-terracotta" />
        <span>MyAssistants</span>
      </p>
      <div className={cx('glass rounded-md rounded-bl-none px-5 py-3.5', wide && 'w-full')}>
        <span className="font-serif text-sm italic text-ink-soft">{t('convo.thinking')}</span>
        <span className="ml-1.5 inline-flex gap-1 align-middle" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="inline-block h-1 w-1 rounded-full bg-ink-soft"
              style={{ animation: 'ink-dot 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </span>
      </div>
    </article>
  );
}

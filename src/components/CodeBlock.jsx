import { memo, useContext, useMemo, useState } from 'react';
import { Icon } from './icons';
import { highlightHtml } from '../lib/markdown';
import { copyText } from '../lib/utils';
import { useT } from '../lib/i18n';
import { useToast } from './Toast';
import { SaveHintContext, useSaveFiles } from './SaveFilesModal';
import { filesFromBlock } from '../lib/files';

// Blok kode: lebar penuh, scroll horizontal, label nama file opsional, tombol salin + Save to Files.
function CodeBlock({ code, lang, filename }) {
  const t = useT();
  const toast = useToast();
  const openSave = useSaveFiles();
  const hint = useContext(SaveHintContext);
  const [copied, setCopied] = useState(false);
  const html = useMemo(() => highlightHtml(code, lang), [code, lang]);
  const lines = useMemo(() => code.split('\n').length, [code]);

  const onCopy = async () => {
    const ok = await copyText(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      toast({ kind: 'error', message: t('toast.copyFailed') });
    }
  };

  return (
    <figure className="code-block">
      <header>
        {filename ? (
          <span className="flex min-w-0 items-center gap-1.5 text-[#eadfcb]">
            <Icon name="file" size={13} className="shrink-0 opacity-70" />
            <span className="truncate">{filename}</span>
          </span>
        ) : null}
        <span className="uppercase tracking-[0.14em] opacity-70">{lang || 'text'}</span>
        <span className="hidden opacity-50 sm:inline">{t('code.lines', { n: lines })}</span>
        <button
          type="button"
          onClick={() => openSave({ files: filesFromBlock({ code, lang, filename }).files, projectHint: hint })}
          className="code-copy ml-auto"
          title={t('code.save')}
        >
          <Icon name="save" size={12} />
          <span className="hidden sm:inline">{t('code.save')}</span>
        </button>
        <button type="button" onClick={onCopy} className="code-copy" aria-label={t('common.copy')}>
          <Icon name={copied ? 'check' : 'copy'} size={12} />
          {copied ? t('common.copied') : t('common.copy')}
        </button>
      </header>
      <pre tabIndex={0}>
        <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </figure>
  );
}

export default memo(CodeBlock);

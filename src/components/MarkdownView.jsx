import { memo, useContext, useMemo } from 'react';
import { toBlocks } from '../lib/markdown';
import { filesFromBlock, normalizePath } from '../lib/files';
import { interceptInternalLink } from '../router';
import { useT } from '../lib/i18n';
import CodeBlock from './CodeBlock';
import { Icon } from './icons';
import { SaveHintContext, useSaveFiles } from './SaveFilesModal';

// Markdown → blok HTML (sudah disanitasi DOMPurify) + <CodeBlock/> untuk kode.
// Kalau jawaban berisi ≥2 file bernama (komentar path), tawarkan "Save all files to project".
function MarkdownView({ text, complete = true }) {
  const t = useT();
  const openSave = useSaveFiles();
  const hint = useContext(SaveHintContext);
  const blocks = useMemo(() => toBlocks(text), [text]);

  const namedFiles = useMemo(() => {
    if (!complete) return [];
    const map = new Map();
    blocks.forEach((b) => {
      if (b.type !== 'code') return;
      const { files, named } = filesFromBlock(b);
      if (named) files.forEach((f) => map.set(normalizePath(f.path) || f.path, f));
    });
    return [...map.values()];
  }, [blocks, complete]);

  return (
    <div className="md" onClick={interceptInternalLink}>
      {blocks.map((b, i) =>
        b.type === 'code' ? (
          <CodeBlock key={i} code={b.code} lang={b.lang} filename={b.filename} />
        ) : (
          <div key={i} dangerouslySetInnerHTML={{ __html: b.html }} />
        ),
      )}
      {namedFiles.length >= 2 && (
        <div className="not-prose mt-4 flex flex-wrap items-center gap-3 border-t-[3px] border-double border-rule pt-4">
          <p className="min-w-0 flex-1 font-serif text-sm italic text-ink-soft">{t('code.multi', { n: namedFiles.length })}</p>
          <button
            type="button"
            className="btn btn-ink"
            onClick={() => openSave({ files: namedFiles, projectHint: hint })}
          >
            <Icon name="folder" size={14} />
            {t('code.saveAll')}
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(MarkdownView);

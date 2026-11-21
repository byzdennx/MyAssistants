import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Modal from './Modal';
import { Icon } from './icons';
import { useToast } from './Toast';
import { useT } from '../lib/i18n';
import { useFiles, useUi } from '../lib/hooks';
import { FilesError, normalizePath, saveFilesToProject } from '../lib/files';
import { setUi } from '../lib/storage';
import { navigate } from '../router';
import { cx } from '../lib/utils';

// Modal "Save to Files": pilih/buat proyek, cek path, simpan satu atau banyak file sekaligus.
const SaveContext = createContext(() => {});
// Nama proyek yang disarankan (judul percakapan aktif).
export const SaveHintContext = createContext('');

export function useSaveFiles() {
  return useContext(SaveContext);
}

export function SaveFilesProvider({ children }) {
  const [request, setRequest] = useState(null);
  const open = useCallback((req) => setRequest({ ...req, key: Date.now() }), []);
  const close = useCallback(() => setRequest(null), []);
  return (
    <SaveContext.Provider value={open}>
      {children}
      <Modal open={!!request} onClose={close} labelledBy="save-title" maxWidth="max-w-xl">
        {request && <SaveForm key={request.key} request={request} onClose={close} />}
      </Modal>
    </SaveContext.Provider>
  );
}

const NEW = '__new__';

// "Buatkan kartu profil editorial pakai React" → "Kartu profil editorial pakai React"
export function suggestProjectName(title) {
  const raw = String(title || '').trim();
  // judul auto-title sudah dipotong 40 karakter ("…") → buang kata terakhir yang terpotong
  let s = (/…$/.test(raw) ? raw.replace(/…$/, '').replace(/\s+\S*$/, '') : raw)
    .replace(/^(tolong|coba|please|bantu(in)?|aku mau|saya mau|mau)\s+/i, '')
    .replace(/^(buat(kan|in)?|bikin(in|kan)?|tulis(kan)?|generate|create|make|build)\s+/i, '')
    .replace(/^(sebuah|satu|a|an)\s+/i, '')
    .replace(/[^\p{L}\p{N}\s.&-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > 32) s = s.slice(0, 32).replace(/\s+\S*$/, '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Proyek baru';
}

function SaveForm({ request, onClose }) {
  const t = useT();
  const toast = useToast();
  const { projects } = useFiles();
  const ui = useUi();
  const hint = suggestProjectName(request.projectHint);

  const initialChoice = useMemo(() => {
    const byHint = projects.find((p) => p.name.toLowerCase() === hint.toLowerCase());
    if (byHint) return byHint.id;
    if (request.files.length === 1 && ui.lastProjectId && projects.some((p) => p.id === ui.lastProjectId)) return ui.lastProjectId;
    return NEW;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [choice, setChoice] = useState(initialChoice);
  const [newName, setNewName] = useState(hint);
  const [files, setFiles] = useState(() => request.files.map((f) => ({ ...f })));

  const project = projects.find((p) => p.id === choice) || null;
  const projectName = choice === NEW ? newName.trim() : project?.name || '';
  const cleanPaths = files.map((f) => normalizePath(f.path));
  const invalid = cleanPaths.some((p) => !p) || new Set(cleanPaths).size !== cleanPaths.length;
  const overwriteCount = project ? cleanPaths.filter((p) => project.files.some((f) => f.path === p)).length : 0;
  const canSave = projectName && !invalid;
  const many = files.length > 1;

  const save = () => {
    if (!canSave) return;
    try {
      const res = saveFilesToProject({ projectName, files });
      setUi({ lastProjectId: res.project.id, filesActive: { projectId: res.project.id, path: res.paths[0] } });
      toast({
        kind: 'success',
        message: t('save.done', { name: res.project.name, n: res.paths.length }),
        action: { label: t('save.open'), onClick: () => navigate('/files') },
      });
      onClose();
    } catch (err) {
      const code = err instanceof FilesError ? err.code : 'quota';
      toast({ kind: 'error', message: t(`files.err.${code}`) });
    }
  };

  return (
    <form
      className="glass-hi rounded-lg px-6 pb-7 pt-7 sm:px-9"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <p className="eyebrow">{t('nav.files')}</p>
      <h2 id="save-title" className="mt-4 font-display text-[2rem] italic leading-tight letterpress">
        {many ? t('save.titleMany', { n: files.length }) : t('save.title')}
      </h2>

      <label className="eyebrow mt-7 block" htmlFor="save-project">
        {t('save.project')}
      </label>
      <select id="save-project" className="field mt-2.5" value={choice} onChange={(e) => setChoice(e.target.value)}>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {t('files.count', { n: p.files.length })}
          </option>
        ))}
        <option value={NEW}>{t('save.newProject')}</option>
      </select>
      {choice === NEW && (
        <input
          className="field mt-2.5"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('save.projectName')}
          aria-label={t('save.projectName')}
          data-autofocus
          maxLength={80}
        />
      )}
      <p className="mt-2 text-[0.72rem] text-ink-faint">{t('save.hint')}</p>

      <p className="eyebrow mt-7">{many ? t('save.paths') : t('save.path')}</p>
      <ul className={cx('mt-2.5 space-y-2', many && 'max-h-64 overflow-y-auto pr-1')}>
        {files.map((f, i) => {
          const exists = project?.files.some((x) => x.path === normalizePath(f.path));
          return (
            <li key={i} className="flex items-center gap-2">
              <Icon name="file" size={14} className="shrink-0 text-ink-faint" />
              <input
                className={cx('field font-mono !py-1.5 !text-[0.8rem]', !normalizePath(f.path) && '!border-terracotta')}
                value={f.path}
                onChange={(e) => setFiles((list) => list.map((x, j) => (j === i ? { ...x, path: e.target.value } : x)))}
                aria-label={`${t('save.path')} ${i + 1}`}
                spellCheck={false}
                data-autofocus={!many && choice !== NEW ? '' : undefined}
              />
              <span className="w-16 shrink-0 text-right font-mono text-[0.66rem] text-ink-faint">
                {exists ? <span className="text-accent">↺</span> : null} {t('files.lines', { n: f.content.split('\n').length })}
              </span>
            </li>
          );
        })}
      </ul>
      {overwriteCount > 0 && (
        <p className="mt-3 font-serif text-xs italic text-accent">{t('save.overwrite', { n: overwriteCount })}</p>
      )}

      <div className="mt-8 flex flex-wrap justify-end gap-4">
        <button type="button" className="btn btn-line" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="btn btn-ink" disabled={!canSave}>
          <Icon name="save" size={14} />
          {t('save.confirm')}
        </button>
      </div>
    </form>
  );
}

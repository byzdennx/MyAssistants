import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FileTree from '../components/FileTree';
import Terminal from '../components/Terminal';
import HtmlPreview from '../components/HtmlPreview';
import EmptyState from '../components/EmptyState';
import { Icon } from '../components/icons';
import { useConfirm, usePrompt } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { Link } from '../router';
import { useT, QUOTES } from '../lib/i18n';
import { useFiles, useMediaQuery, useUi } from '../lib/hooks';
import { setUi } from '../lib/storage';
import {
  FilesError,
  createFile,
  createProject,
  deleteFile,
  deleteProject,
  downloadSingleFile,
  exportAllFilesJson,
  exportProjectJson,
  exportProjectZip,
  importProjects,
  languageFromPath,
  normalizePath,
  projectBytes,
  readFilesImport,
  renameFile,
  renameProject,
  updateFile,
} from '../lib/files';
import { copyText, cx, formatBytes, relativeTime } from '../lib/utils';

export default function Files() {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const ui = useUi();
  const { projects } = useFiles();
  const isMd = useMediaQuery('(min-width: 768px)');
  const importRef = useRef(null);
  const [previewOn, setPreviewOn] = useState(false);
  const [previewEntry, setPreviewEntry] = useState(null);
  const termOpen = ui.filesTerm ?? true;
  const toggleTerm = () => setUi({ filesTerm: !termOpen });

  /* ── seleksi (disimpan supaya bertahan setelah refresh) ── */
  const sel = ui.filesActive || {};
  const project = projects.find((p) => p.id === sel.projectId) || projects[0] || null;
  const file = project?.files.find((f) => f.path === sel.path) || null;

  // halaman HTML untuk preview: pilihan di preview → index.html → HTML pertama
  const htmlFiles = (project?.files || []).map((f) => f.path).filter((p) => /\.html?$/i.test(p));
  const entry =
    (previewEntry && htmlFiles.includes(previewEntry) ? previewEntry : null) ||
    htmlFiles.find((p) => p === 'index.html') ||
    htmlFiles[0] ||
    null;
  // membuka file HTML di editor → jadikan halaman preview
  useEffect(() => {
    if (file && /\.html?$/i.test(file.path)) setPreviewEntry(file.path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.path]);
  const select = useCallback((projectId, path = null) => setUi({ filesActive: { projectId, path } }), []);

  /* ── sidebar ── */
  const desktopSidebar = ui.sidebar?.files ?? true;
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const sidebarOpen = isMd ? desktopSidebar : mobileSidebar;
  const toggleSidebar = () => {
    if (isMd) setUi({ sidebar: { ...(ui.sidebar || {}), files: !desktopSidebar } });
    else setMobileSidebar((v) => !v);
  };

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setMobileSidebar(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ── helper error ── */
  const fail = (err) => {
    const code = err instanceof FilesError ? err.code : 'quota';
    toast({ kind: 'error', message: t(`files.err.${code}`) });
  };

  /* ── aksi proyek ── */
  const onNewProject = async () => {
    const name = await prompt({
      title: t('files.prompt.newProject'),
      input: { label: t('files.prompt.projectName'), placeholder: 'Landing Kopi' },
      confirmLabel: t('files.newProject'),
    });
    if (!name) return;
    try {
      const p = createProject(name);
      select(p.id);
      toast({ kind: 'success', message: t('files.toast.created'), duration: 2400 });
    } catch (err) {
      fail(err);
    }
  };

  const onRenameProject = async () => {
    if (!project) return;
    const name = await prompt({
      title: t('files.prompt.renameProject'),
      input: { label: t('files.prompt.projectName'), defaultValue: project.name },
      confirmLabel: t('files.rename'),
    });
    if (!name || name === project.name) return;
    try {
      renameProject(project.id, name);
      toast({ kind: 'success', message: t('files.toast.renamed'), duration: 2400 });
    } catch (err) {
      fail(err);
    }
  };

  const onDeleteProject = async () => {
    if (!project) return;
    const ok = await confirm({
      title: t('files.confirm.deleteProject'),
      body: t('files.confirm.deleteProject.body', { name: project.name, n: project.files.length }),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    });
    if (!ok) return;
    if (file) window.dispatchEvent(new CustomEvent('ma:discard-file', { detail: file.path }));
    deleteProject(project.id);
    setUi({ filesActive: {} });
    toast({ kind: 'info', message: t('files.toast.deleted'), duration: 2400 });
  };

  const onExportJson = () => {
    if (!project) return;
    exportProjectJson(project);
    toast({ kind: 'success', message: t('files.toast.exported'), duration: 2400 });
  };

  const onExportZip = async () => {
    if (!project) return;
    try {
      await exportProjectZip(project);
      toast({ kind: 'success', message: t('files.toast.exported'), duration: 2400 });
    } catch {
      toast({ kind: 'error', message: t('files.err.zip') });
    }
  };

  const onImport = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const res = await readFilesImport(f);
    if (!res.ok) {
      toast({ kind: 'error', message: t('files.toast.invalid', { reason: t(`files.importErr.${res.code}`) }) });
      return;
    }
    try {
      importProjects(res.projects, 'merge');
      toast({ kind: 'success', message: t('files.toast.imported', { p: res.summary.projects, f: res.summary.files }) });
    } catch (err) {
      fail(err);
    }
  };

  /* ── aksi file ── */
  const onNewFile = async () => {
    if (!project) return;
    const path = await prompt({
      title: t('files.prompt.newFile', { name: project.name }),
      input: { label: t('files.prompt.path'), placeholder: 'src/App.jsx', mono: true },
      confirmLabel: t('files.newFile'),
    });
    if (!path) return;
    try {
      const p = createFile(project.id, path, '');
      const created = p.files.find((f) => f.path === normalizePath(path)) || p.files[p.files.length - 1];
      select(project.id, created.path);
      setMobileSidebar(false);
      toast({ kind: 'success', message: t('files.toast.fileCreated'), duration: 2400 });
    } catch (err) {
      fail(err);
    }
  };

  const onRenameFile = async (path) => {
    if (!project) return;
    const next = await prompt({
      title: t('files.prompt.renameFile'),
      input: { label: t('files.prompt.path'), defaultValue: path, mono: true },
      confirmLabel: t('files.rename'),
    });
    if (!next || next === path) return;
    try {
      // simpan draf editor dulu supaya isi terakhir ikut pindah
      window.dispatchEvent(new Event('ma:flush-file'));
      const p = renameFile(project.id, path, next);
      if (file?.path === path) {
        const moved = p.files.find((f) => !project.files.some((o) => o.path === f.path));
        select(project.id, moved ? moved.path : null);
      }
      toast({ kind: 'success', message: t('files.toast.renamed'), duration: 2400 });
    } catch (err) {
      fail(err);
    }
  };

  const onDeleteFile = async (path) => {
    if (!project) return;
    const ok = await confirm({
      title: t('files.confirm.deleteFile'),
      body: t('files.confirm.deleteFile.body', { path, name: project.name }),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    });
    if (!ok) return;
    window.dispatchEvent(new CustomEvent('ma:discard-file', { detail: path }));
    deleteFile(project.id, path);
    if (file?.path === path) select(project.id, null);
    toast({ kind: 'info', message: t('files.toast.deleted'), duration: 2400 });
  };

  const quote = useMemo(() => {
    const quotes = QUOTES[t.lang] || QUOTES.id;
    return quotes[(Math.floor(Date.now() / 86400000) + 3) % quotes.length];
  }, [t.lang]);

  /* ── HP: hanya daftar file & folder; editor + teleprinter khusus PC ── */
  if (!isMd) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-rule px-3">
          <select
            className="field min-w-0 flex-1 !py-1.5 !text-[0.82rem]"
            value={project?.id || ''}
            onChange={(e) => select(e.target.value, null)}
            aria-label={t('files.projects')}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {t('files.count', { n: p.files.length })}
              </option>
            ))}
          </select>
          <button type="button" className="icon-btn" onClick={onNewProject} aria-label={t('files.newProject')} title={t('files.newProject')}>
            <Icon name="plus" size={17} />
          </button>
          <button type="button" className="icon-btn" onClick={() => importRef.current?.click()} aria-label={t('files.import')} title={t('files.import')}>
            <Icon name="upload" size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              exportAllFilesJson();
              toast({ kind: 'success', message: t('files.toast.exported'), duration: 2400 });
            }}
            aria-label={t('files.exportAll')}
            title={t('files.exportAll')}
          >
            <Icon name="download" size={16} />
          </button>
        </div>
        <input ref={importRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onImport} />

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {project?.files.length ? (
            <FileTree
              files={project.files}
              activePath={null}
              readOnly
              onSelect={(path) => {
                select(project.id, path);
                toast({ kind: 'info', message: t('files.mobile.note'), duration: 3200 });
              }}
            />
          ) : (
            <p className="px-4 py-8 text-center font-serif text-sm italic text-ink-faint">{t('files.projectEmpty')}</p>
          )}
        </div>

        <p className="shrink-0 border-t border-rule px-4 py-3 text-center font-serif text-xs italic leading-relaxed text-ink-faint">
          {t('files.mobile.note')}
        </p>
      </div>
    );
  }

  /* ── tanpa proyek sama sekali ── */
  if (projects.length === 0) {
    return (
      <div className="h-full overflow-y-auto">
        <input ref={importRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onImport} />
        <EmptyState
          className="pt-16"
          title={t('files.empty.title')}
          body={t('files.empty.body')}
          quote={quote}
          hint={
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link to="/coder" className="btn btn-ink">
                <Icon name="code" size={14} />
                {t('files.empty.coder')}
              </Link>
              <button type="button" className="btn btn-line" onClick={onNewProject}>
                <Icon name="plus" size={14} />
                {t('files.newProject')}
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => importRef.current?.click()}>
                <Icon name="upload" size={14} />
                {t('files.import')}
              </button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0">
      <input ref={importRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onImport} />

      {/* ── sidebar: proyek + tree ── */}
      {sidebarOpen && (
        <>
          <div className="fade-in absolute inset-0 z-20 bg-sepia/35 backdrop-blur-[2px] md:hidden" onClick={() => setMobileSidebar(false)} aria-hidden="true" />
          <aside
            aria-label={t('files.sidebar')}
            className="fade-slide glass-hi absolute inset-y-0 left-0 z-30 flex w-[86vw] max-w-xs flex-col bg-paper/90 md:static md:z-auto md:w-72 md:max-w-none md:shrink-0 md:rounded-none md:border-y-0 md:border-l-0 md:border-r-rule md:bg-transparent md:shadow-none"
          >
            <div className="flex items-center gap-2 border-b border-rule p-3">
              <button type="button" className="btn btn-ink flex-1" onClick={onNewProject}>
                <Icon name="plus" size={14} />
                {t('files.newProject')}
              </button>
              <button type="button" className="icon-btn" onClick={() => importRef.current?.click()} title={t('files.import')} aria-label={t('files.import')}>
                <Icon name="upload" size={16} />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  exportAllFilesJson();
                  toast({ kind: 'success', message: t('files.toast.exported'), duration: 2400 });
                }}
                title={t('files.exportAll')}
                aria-label={t('files.exportAll')}
              >
                <Icon name="download" size={16} />
              </button>
              <button type="button" className="icon-btn md:hidden" onClick={() => setMobileSidebar(false)} aria-label={t('common.close')}>
                <Icon name="x" size={16} />
              </button>
            </div>

            <p className="eyebrow px-4 pb-2 pt-4">{t('files.projects')}</p>
            <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              <ul className="space-y-0.5">
                {projects.map((p) => {
                  const active = p.id === project?.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => select(p.id, active ? file?.path || null : null)}
                        aria-expanded={active}
                        className={cx(
                          'flex w-full items-baseline gap-2 rounded-sm px-3 py-2 text-left transition-colors duration-200',
                          active ? 'bg-ink/[0.07]' : 'hover:bg-ink/[0.04]',
                        )}
                      >
                        <Icon name={active ? 'folder-open' : 'folder'} size={14} className="shrink-0 translate-y-[2px] text-accent" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-serif text-[0.92rem] text-ink">{p.name}</span>
                          <span className="block text-[0.66rem] text-ink-faint">
                            {t('files.count', { n: p.files.length })} · {relativeTime(p.updatedAt, t.lang)}
                          </span>
                        </span>
                      </button>
                      {active && (
                        <div className="fade-in ml-2 border-l border-rule pb-2 pl-1">
                          {p.files.length === 0 ? (
                            <p className="px-3 py-2 font-serif text-xs italic text-ink-faint">{t('files.projectEmpty')}</p>
                          ) : (
                            <FileTree
                              files={p.files}
                              activePath={file?.path || null}
                              onSelect={(path) => {
                                select(p.id, path);
                                setMobileSidebar(false);
                              }}
                              onRename={onRenameFile}
                              onDelete={onDeleteFile}
                            />
                          )}
                          <button type="button" className="btn btn-quiet ml-1 mt-1" onClick={onNewFile}>
                            <Icon name="file-plus" size={13} />
                            {t('files.newFile')}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>
            <p className="hidden border-t border-rule px-4 py-3 font-serif text-[0.7rem] italic text-ink-faint md:block">
              Crafted with care by EpannXD · © 2025
            </p>
          </aside>
        </>
      )}

      {/* ── panel utama ── */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-rule px-2 sm:px-3">
          <button type="button" className="icon-btn" onClick={toggleSidebar} aria-label={t('files.toggleSidebar')} aria-expanded={sidebarOpen} title={t('files.toggleSidebar')}>
            <Icon name="sidebar" size={17} />
          </button>
          <h1 className="min-w-0 flex-1 truncate font-serif text-[0.95rem] text-ink">
            {project?.name}
            <span className="ml-2.5 align-middle text-[0.62rem] uppercase tracking-[0.18em] text-ink-faint">
              {t('files.count', { n: project?.files.length || 0 })} · {formatBytes(project ? projectBytes(project) : 0)} / 250 MB
            </span>
          </h1>
          <button type="button" className="btn btn-quiet" onClick={onNewFile} title={t('files.newFile')}>
            <Icon name="file-plus" size={14} />
            <span className="hidden lg:inline">{t('files.newFile')}</span>
          </button>
          <button type="button" className="btn btn-quiet" onClick={onRenameProject} title={t('files.renameProject')}>
            <Icon name="pencil" size={14} />
            <span className="hidden lg:inline">{t('files.rename')}</span>
          </button>
          <button type="button" className="btn btn-quiet" onClick={onExportJson} title={`${t('common.export')} JSON`}>
            <Icon name="download" size={14} />
            <span className="hidden sm:inline">{t('files.exportJson')}</span>
          </button>
          <button type="button" className="btn btn-quiet" onClick={onExportZip} title={`${t('common.export')} ZIP`} disabled={!project?.files.length}>
            <Icon name="archive" size={14} />
            <span className="hidden sm:inline">{t('files.exportZip')}</span>
          </button>
          {htmlFiles.length > 0 && (
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => setPreviewOn((v) => !v)}
              aria-pressed={previewOn}
              title={t('preview.toggle')}
            >
              <Icon name="eye" size={14} />
              <span className="hidden lg:inline">{t('preview.toggle')}</span>
            </button>
          )}
          <button type="button" className="btn btn-quiet" onClick={toggleTerm} aria-expanded={termOpen} aria-pressed={termOpen} title={t('term.title')}>
            <Icon name="code" size={14} />
            <span className="hidden lg:inline">{t('term.title')}</span>
          </button>
          <button type="button" className="icon-btn" onClick={onDeleteProject} title={t('files.deleteProject')} aria-label={t('files.deleteProject')}>
            <Icon name="trash" size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
          {file ? (
            <Editor
              key={`${project.id}:${file.path}`}
              project={project}
              file={file}
              onRename={() => onRenameFile(file.path)}
              onDelete={() => onDeleteFile(file.path)}
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <EmptyState
                className="pt-10"
                title={project?.files.length ? t('files.noFile.title') : t('files.projectEmpty')}
                body={t('files.noFile.body')}
                hint={
                  <button type="button" className="btn btn-line" onClick={onNewFile}>
                    <Icon name="file-plus" size={14} />
                    {t('files.newFile')}
                  </button>
                }
              />
            </div>
          )}
          </div>
          {previewOn && entry && (
            <div className="flex min-w-0 flex-1 flex-col border-l-[3px] border-double border-rule-strong">
              <HtmlPreview files={project.files} entryPath={entry} onEntryChange={setPreviewEntry} />
            </div>
          )}
          </div>

          {termOpen ? (
            <div className="h-60 shrink-0 border-t-[3px] border-double border-rule-strong sm:h-64">
              <Terminal
                key={project.id}
                project={project}
                activePath={file?.path || null}
                onSaved={(path) => select(project.id, path)}
                onCollapse={toggleTerm}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={toggleTerm}
              className="flex h-8 shrink-0 items-center justify-center gap-2 border-t-[3px] border-double border-rule-strong bg-[#1d1610] font-mono text-[0.7rem] text-[#c9a961] transition-colors duration-200 hover:text-[#e7dcc6]"
            >
              <Icon name="chevron-right" size={12} className="-rotate-90" />
              {t('term.expand')} · {project?.name}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

/* ── editor dengan nomor baris, autosave 500 ms, Ctrl/Cmd+S ── */
function Editor({ project, file, onRename, onDelete }) {
  const t = useT();
  const toast = useToast();
  const [value, setValue] = useState(file.content);
  const valueRef = useRef(file.content);
  const savedRef = useRef(file.content);
  const discarded = useRef(false);
  const gutter = useRef(null);
  const area = useRef(null);
  const [dirty, setDirty] = useState(false);

  const persist = useCallback(
    (silent = true) => {
      if (discarded.current) return;
      if (valueRef.current === savedRef.current) {
        if (!silent) toast({ kind: 'success', message: t('files.toast.saved'), duration: 1800 });
        return;
      }
      try {
        updateFile(project.id, file.path, valueRef.current);
        savedRef.current = valueRef.current;
        setDirty(false);
        if (!silent) toast({ kind: 'success', message: t('files.toast.saved'), duration: 1800 });
      } catch (err) {
        const code = err instanceof FilesError ? err.code : 'quota';
        toast({ kind: 'error', message: t(`files.err.${code}`) });
      }
    },
    [project.id, file.path, t, toast],
  );

  // autosave (debounce 500 ms)
  useEffect(() => {
    if (!dirty) return undefined;
    const h = setTimeout(() => persist(true), 500);
    return () => clearTimeout(h);
  }, [value, dirty, persist]);

  // isi berubah dari luar (mis. ditimpa dari Coder) dan tidak sedang diedit → ikut
  useEffect(() => {
    if (file.content !== savedRef.current && valueRef.current === savedRef.current) {
      savedRef.current = file.content;
      valueRef.current = file.content;
      setValue(file.content);
    }
  }, [file.content]);

  // Ctrl/Cmd+S, flush sebelum rename, buang draf saat file dihapus, flush saat pindah file
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        persist(false);
      }
    };
    const onFlush = () => persist(true);
    const onDiscard = (e) => {
      if (e.detail === file.path) discarded.current = true;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('ma:flush-file', onFlush);
    window.addEventListener('ma:discard-file', onDiscard);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('ma:flush-file', onFlush);
      window.removeEventListener('ma:discard-file', onDiscard);
      persist(true);
    };
  }, [persist, file.path]);

  const onChange = (v) => {
    valueRef.current = v;
    setValue(v);
    setDirty(v !== savedRef.current);
  };

  // Tab → 2 spasi
  const onKeyDown = (e) => {
    if (e.key === 'Tab' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: s, selectionEnd: end } = el;
      const next = value.slice(0, s) + '  ' + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
    }
  };

  const lineCount = value.split('\n').length;
  const numbers = useMemo(() => Array.from({ length: lineCount }, (_, i) => i + 1).join('\n'), [lineCount]);
  const lang = languageFromPath(file.path);
  const dir = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/') + 1) : '';
  const base = file.path.slice(dir.length);

  const copy = async () => {
    const ok = await copyText(value);
    toast({ kind: ok ? 'success' : 'error', message: ok ? t('toast.copied') : t('toast.copyFailed'), duration: 2000 });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-5">
      <div className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-md">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule px-3 py-2 sm:px-4">
          <p className="min-w-0 flex-1 truncate font-mono text-[0.78rem]" title={file.path}>
            <span className="text-ink-faint">{dir}</span>
            <span className="text-ink">{base}</span>
          </p>
          <span className="eyebrow hidden sm:inline">{lang}</span>
          <span className="hidden font-mono text-[0.66rem] text-ink-faint sm:inline">{t('files.lines', { n: lineCount })}</span>
          <span className={cx('inline-flex items-center gap-1.5 text-[0.7rem]', dirty ? 'text-accent' : 'text-sage-ink')} role="status">
            <span aria-hidden="true" className={cx('inline-block h-1.5 w-1.5 rounded-full', dirty ? 'bg-terracotta' : 'bg-sage')} />
            {dirty ? t('files.unsaved') : t('files.saved')}
          </span>
        </div>

        <div className="relative flex min-h-0 flex-1 bg-[#231a13] text-[#eadfcb]">
          <pre
            ref={gutter}
            aria-hidden="true"
            className="m-0 shrink-0 select-none overflow-hidden border-r border-[rgba(255,235,205,0.1)] px-3 py-3 text-right font-mono text-[0.78rem] leading-[1.6] text-[#8f806b]"
          >
            {numbers}
          </pre>
          <textarea
            ref={area}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onScroll={(e) => {
              if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
            }}
            wrap="off"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            aria-label={t('files.editor', { path: file.path })}
            className="composer-input min-h-0 min-w-0 flex-1 resize-none whitespace-pre border-0 bg-transparent px-4 py-3 font-mono text-[0.78rem] leading-[1.6] text-inherit caret-[#e0906f] outline-none selection:bg-[#b8654a]/50"
            style={{ tabSize: 2 }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-rule px-2 py-2 sm:px-3">
          <p className="hidden min-w-0 flex-1 truncate text-[0.68rem] text-ink-faint md:block">{t('files.shortcut')}</p>
          <span className="flex-1 md:hidden" />
          <button type="button" className="btn btn-quiet" onClick={onRename}>
            <Icon name="pencil" size={13} />
            <span className="hidden sm:inline">{t('files.rename')}</span>
          </button>
          <button type="button" className="btn btn-quiet" onClick={onDelete} aria-label={t('files.deleteFile')}>
            <Icon name="trash" size={13} />
            <span className="hidden sm:inline">{t('common.delete')}</span>
          </button>
          <button type="button" className="btn btn-quiet" onClick={copy}>
            <Icon name="copy" size={13} />
            {t('common.copy')}
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => downloadSingleFile({ path: file.path, content: value })}>
            <Icon name="download" size={13} />
            {t('files.download')}
          </button>
          <button type="button" className="btn btn-ink !py-1.5" onClick={() => persist(false)}>
            <Icon name="save" size={13} />
            {t('files.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// TELEPRINTER — terminal ala CLI di File Manager.
// Mengingat percakapan per proyek (localStorage) dan selalu membawa konteks file terbaru.
// Kode yang dihasilkan AUTO-TERSIMPAN ke proyek; terminal hanya mencetak "✓ membuat file <path>".
// Perintah lokal: help · clear (layar) · forget (hapus ingatan AI) · ls · new <path>.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './icons';
import { useT } from '../lib/i18n';
import { useQuotaModal } from './QuotaModal';
import { useSettings } from '../lib/hooks';
import { appendTerminalTurns, clearTerminalMemory, getTerminalMemory } from '../lib/storage';
import { chatCompletion, describeError, truncateHistory } from '../lib/api';
import { modelLabel } from '../config/providers';
import { extractCoderFiles, stripCodeBlocks } from '../lib/markdown';
import { contentBytes, cx, formatBytes } from '../lib/utils';
import { FilesError, MAX_PROJECT_BYTES, createFile, projectBytes, saveFilesToProject } from '../lib/files';
import { consumeQuota, getQuota, refundQuota } from '../lib/rateLimit';

let lineSeq = 0;
const MEMORY_BUDGET = 24000; // karakter riwayat yang dikirim ulang
const FILE_BUDGET = 16000; // karakter isi file yang ikut sebagai konteks
const PER_FILE = 6000;

// Konteks proyek: daftar file + isi file aktif dan file yang ditulis giliran terakhir.
function buildContext(proj, activePath, lastFiles) {
  const list = proj.files.map((f) => `- ${f.path} (${formatBytes(contentBytes(f.content))})`).join('\n') || '(kosong)';
  const seen = new Set();
  const blocks = [];
  let used = 0;
  for (const path of [activePath, ...lastFiles]) {
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const f = proj.files.find((x) => x.path === path);
    if (!f) continue;
    const body = f.content.length > PER_FILE ? `${f.content.slice(0, PER_FILE)}\n…(dipotong)` : f.content;
    if (used + body.length > FILE_BUDGET) break;
    used += body.length;
    blocks.push(`--- ${f.path} ---\n${body}`);
  }
  const parts = ['KONTEKS FILE MANAGER', `Proyek aktif: ${proj.name}`, 'File yang ada:', list];
  if (blocks.length) parts.push(`\nIsi file terkait:\n${blocks.join('\n\n')}`);
  parts.push(
    '\nFormat balasan: setiap file ditulis dalam blok kode dengan komentar path di baris pertama, contoh // src/App.jsx. Untuk mengubah file yang sudah ada, tulis ulang seluruh isinya dengan path yang sama. Penjelasan singkat boleh di luar blok kode.',
  );
  return parts.join('\n');
}

// Ingatan (riwayat) + konteks terbaru + permintaan sekarang.
function buildMessages(memory, context, cmd) {
  let history = truncateHistory(memory.map((m) => ({ role: m.role, content: m.content })), MEMORY_BUDGET);
  while (history.length && history[0].role !== 'user') history = history.slice(1);
  return [...history, { role: 'user', content: `${context}\n\nPermintaan:\n${cmd}` }];
}

export default function Terminal({ project, activePath, onSaved, onCollapse }) {
  const t = useT();
  const settings = useSettings();
  const { openQuota } = useQuotaModal();
  const animOn = settings.animations;

  const boot = useMemo(() => {
    const items = [
      project ? { kind: 'info', text: t('term.boot1', { name: project.name }) } : { kind: 'info', text: t('term.noProject') },
      { kind: 'info', text: t('term.boot2', { model: modelLabel(settings.coderModel) }) },
    ];
    const turns = project ? getTerminalMemory(project.id).length : 0;
    if (turns) items.push({ kind: 'info', text: t('term.memory', { n: Math.ceil(turns / 2) }) });
    items.push({ kind: 'info', text: t('term.boot3') });
    return items.map((l) => ({ ...l, id: ++lineSeq, instant: true }));
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [lines, setLines] = useState(boot);
  const [live, setLive] = useState(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [histIdx, setHistIdx] = useState(-1);
  const [tick, setTick] = useState(0);
  const queue = useRef([]);
  const history = useRef([]);
  const scroller = useRef(null);
  const inputRef = useRef(null);
  const projectRef = useRef(project);
  projectRef.current = project;
  const activePathRef = useRef(activePath);
  activePathRef.current = activePath;

  const say = useCallback((items) => {
    const list = Array.isArray(items) ? items : [items];
    queue.current.push(...list.map((l) => ({ ...l, id: ++lineSeq })));
    setTick((v) => v + 1); // memicu pemrosesan antrean
  }, []);

  // antrean baris
  useEffect(() => {
    if (live !== null) return;
    let next = queue.current[0];
    while (next && (next.instant || !next.text)) {
      queue.current.shift();
      if (next.text) {
        const line = next; // tangkap nilainya — updater dijalankan belakangan oleh React
        setLines((l) => [...l.slice(-300), line]);
      }
      next = queue.current[0];
    }
    if (!next) return;
    queue.current.shift();
    setLive(animOn ? { ...next, shown: 0 } : { ...next, shown: next.text.length });
  }, [live, tick, animOn]);

  // efek mengetik per baris
  useEffect(() => {
    if (!live) return undefined;
    if (live.shown >= live.text.length) {
      const done = live;
      setLines((l) => [...l.slice(-300), done]);
      setLive(null);
      return undefined;
    }
    const id = setInterval(() => {
      setLive((prev) => (prev ? { ...prev, shown: Math.min(prev.text.length, prev.shown + 3) } : prev));
    }, 9);
    return () => clearInterval(id);
  }, [live]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, live]);

  const errText = useCallback(
    (err) => {
      if (err instanceof FilesError) return t(`files.err.${err.code}`);
      return describeError(t, err);
    },
    [t],
  );

  const runAI = useCallback(
    async (cmd) => {
      const proj = projectRef.current;
      say([{ kind: 'info', text: `→ ${t('term.contacting')}` }]);
      if (!getQuota().canSend) {
        openQuota();
        say([{ kind: 'err', text: t('term.quota') }]);
        return;
      }
      const stamp = consumeQuota();
      setBusy(true);

      const memory = getTerminalMemory(proj.id);
      const lastFiles = [...memory].reverse().find((m) => m.role === 'assistant' && m.files)?.files || [];
      const messages = buildMessages(memory, buildContext(proj, activePathRef.current, lastFiles), cmd);
      const now = Date.now();

      try {
        const res = await chatCompletion({
          modelKey: settings.coderModel,
          messages,
          stream: false,
        });
        const files = extractCoderFiles(res.text);
        const prose = stripCodeBlocks(res.text);

        if (!files.length) {
          refundQuota(stamp); // tidak ada kode → jatah dikembalikan
          say([{ kind: 'err', text: t('term.noFiles') }, ...(prose ? [{ kind: 'out', text: prose.slice(0, 1200) }] : [])]);
          appendTerminalTurns(proj.id, [
            { role: 'user', content: cmd, ts: now },
            { role: 'assistant', content: prose || '(tanpa teks)', ts: now },
          ]);
          return;
        }

        const added = files.reduce((n, f) => n + contentBytes(f.content), 0);
        if (projectBytes(proj) + added > MAX_PROJECT_BYTES) {
          refundQuota(stamp);
          say([{ kind: 'err', text: t('files.err.too_large') }]);
          return;
        }

        saveFilesToProject({ projectName: proj.name, files });
        files.forEach((f) => say({ kind: 'file', text: `✓ ${t('term.creating')} ${f.path} (${formatBytes(contentBytes(f.content))})` }));
        say({ kind: 'ok', text: `✔ ${t('term.saved', { name: proj.name, n: files.length })}` });

        const paths = files.map((f) => f.path);
        const summary = [prose, `[${t('term.wrote')}: ${paths.join(', ')}]`].filter(Boolean).join('\n\n');
        appendTerminalTurns(proj.id, [
          { role: 'user', content: cmd, ts: now },
          { role: 'assistant', content: summary, files: paths, ts: now },
        ]);
        onSaved?.(paths[0]);
      } catch (err) {
        refundQuota(stamp);
        say([{ kind: 'err', text: t('term.err', { msg: errText(err) }) }]);
      } finally {
        setBusy(false);
      }
    },
    [errText, onSaved, openQuota, say, t],
  );

  const submit = useCallback(() => {
    const cmd = input.trim();
    if (!cmd || busy) return;
    setInput('');
    setHistIdx(-1);
    history.current = [cmd, ...history.current].slice(0, 40);
    say([{ kind: 'in', text: cmd, instant: true }]);

    const proj = projectRef.current;
    if (!proj) {
      say([{ kind: 'err', text: t('term.noProject') }]);
      return;
    }
    if (!navigator.onLine) {
      say([{ kind: 'err', text: t('term.offline') }]);
      return;
    }

    const [head, ...rest] = cmd.split(/\s+/);
    const arg = rest.join(' ');
    if (head === 'help') {
      say([
        { kind: 'info', text: t('term.help.title') },
        ...['help', 'clear', t('term.help.forget'), 'ls', 'new <path>', t('term.help.other')].map((text) => ({ kind: 'out', text: `  ${text}` })),
      ]);
      return;
    }
    if (head === 'clear') {
      setLines(boot);
      queue.current = [];
      setLive(null);
      return;
    }
    if (head === 'forget') {
      clearTerminalMemory(proj.id);
      say([{ kind: 'info', text: t('term.forgot') }]);
      return;
    }
    if (head === 'ls') {
      if (!proj.files.length) say([{ kind: 'out', text: t('term.empty') }]);
      else proj.files.forEach((f) => say({ kind: 'out', text: `${f.path}  ·  ${formatBytes(contentBytes(f.content))}` }));
      return;
    }
    if (head === 'new' && arg) {
      try {
        createFile(proj.id, arg, '');
        say([{ kind: 'file', text: `✓ ${t('term.fileCreated', { path: arg })}` }]);
        onSaved?.(arg);
      } catch (err) {
        say([{ kind: 'err', text: errText(err) }]);
      }
      return;
    }
    runAI(cmd);
  }, [boot, busy, errText, input, onSaved, runAI, say, t]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(histIdx + 1, history.current.length - 1);
      if (next >= 0) {
        setHistIdx(next);
        setInput(history.current[next]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = histIdx - 1;
      setHistIdx(next);
      setInput(next >= 0 ? history.current[next] : '');
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#1d1610] text-[#e7dcc6]">
      <div className="flex items-center gap-3 border-b border-[rgba(255,235,205,0.1)] bg-[rgba(255,235,205,0.04)] px-4 py-2">
        <span aria-hidden="true" className="flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full bg-[rgba(255,235,205,0.25)]" />
          ))}
        </span>
        <p className="eyebrow !text-[#c9a961]">{t('term.title')}</p>
        <span className="min-w-0 flex-1 truncate font-mono text-[0.68rem] text-[#8f806b]">
          {project ? project.name : '—'} · {modelLabel(settings.coderModel)}
        </span>
        <button type="button" onClick={onCollapse} className="code-copy" aria-label={t('term.collapse')} title={t('term.collapse')}>
          <Icon name="chevron-down" size={13} />
        </button>
      </div>

      <div
        ref={scroller}
        onClick={() => inputRef.current?.focus()}
        className="min-h-0 flex-1 cursor-text overflow-y-auto px-4 py-3 font-mono text-[0.78rem] leading-[1.7]"
      >
        {lines.map((l) => (
          <TermLine key={l.id} line={l} project={project} />
        ))}
        {live && <TermLine line={{ ...live, text: live.text.slice(0, live.shown) }} typing project={project} />}
        <div className="mt-1 flex items-center gap-2">
          <span className="shrink-0 text-[#c9a961]">{project ? `${project.name} $` : '$'}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={busy}
            placeholder={busy ? '' : t('term.placeholder')}
            aria-label={t('term.title')}
            spellCheck={false}
            autoComplete="off"
            className="min-w-0 flex-1 border-0 bg-transparent font-mono text-[0.78rem] text-[#e7dcc6] caret-[#e0906f] outline-none placeholder:text-[#6b5d4b]"
          />
          <span className={cx('type-caret', busy && 'opacity-0')} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function TermLine({ line, typing, project }) {
  const cls = {
    in: 'text-[#c9a961]',
    out: 'text-[#cfc2a9]',
    file: 'text-[#a9bd9a]',
    ok: 'text-[#a9bd9a] font-medium',
    err: 'text-[#e0906f]',
    info: 'italic text-[#8f806b]',
  }[line.kind];
  if (line.kind === 'in') {
    return (
      <p className={cls}>
        <span className="mr-2">{project ? `${project.name} $` : '$'}</span>
        {line.text}
      </p>
    );
  }
  return (
    <p className={cx('whitespace-pre-wrap break-words', cls)}>
      {line.text}
      {typing && <span className="type-caret" aria-hidden="true" />}
    </p>
  );
}

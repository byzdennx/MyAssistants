import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ConversationSidebar from './ConversationSidebar';
import MessageList from './MessageList';
import Composer from './Composer';
import EmptyState from './EmptyState';
import ExportMenu from './ExportMenu';
import { Icon } from './icons';
import { useConfirm } from './ConfirmModal';
import { useToast } from './Toast';
import { SaveHintContext } from './SaveFilesModal';
import { A, Link, navigate } from '../router';
import { useT, QUOTES } from '../lib/i18n';
import { useConversations, useFiles, useMediaQuery, useSettings, useUi } from '../lib/hooks';
import { TEXT_MODELS, modelLabel, resolveModel } from '../config/providers';
import { updateSettings } from '../lib/storage';
import { deleteConversation, getDraft, setDraft, setUi } from '../lib/storage';

export default function ConversationView({ mode, route, engine, showSearch = true }) {
  const t = useT();
  const confirm = useConfirm();
  const toast = useToast();
  const ui = useUi();
  const isMd = useMediaQuery('(min-width: 768px)');
  const wide = mode === 'coder';
  const settings = useSettings();
  const modelKey = mode === 'coder' ? settings.coderModel : settings.chatModel;
  const setModelKey = (v) => updateSettings(mode === 'coder' ? { coderModel: v } : { chatModel: v });

  const id = route.segments[1] || null;
  const all = useConversations();
  const list = useMemo(() => all.filter((c) => c.mode === mode), [all, mode]);
  const conversation = useMemo(() => list.find((c) => c.id === id) || null, [list, id]);
  const { projects } = useFiles();
  const boundProject = mode === 'coder' && conversation?.projectId ? projects.find((p) => p.id === conversation.projectId) || null : null;

  // id di URL tidak ada (mis. baru dihapus) → kembali ke percakapan baru
  useEffect(() => {
    if (id && !conversation) navigate(`/${mode}`, { replace: true });
  }, [id, conversation, mode]);

  /* ── sidebar ── */
  const desktopSidebar = ui.sidebar?.[mode] ?? true;
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const sidebarOpen = isMd ? desktopSidebar : mobileSidebar;
  const toggleSidebar = () => {
    if (isMd) setUi({ sidebar: { ...(ui.sidebar || {}), [mode]: !desktopSidebar } });
    else setMobileSidebar((v) => !v);
  };
  const closeSidebar = useCallback(() => setMobileSidebar(false), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileSidebar(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ── draf ── */
  const draftKey = `${mode}:${conversation?.id || 'new'}`;
  const [text, setText] = useState(() => getDraft(draftKey));
  const keyRef = useRef(draftKey);
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    if (keyRef.current === draftKey) return;
    setDraft(keyRef.current, textRef.current);
    keyRef.current = draftKey;
    setText(getDraft(draftKey));
  }, [draftKey]);

  useEffect(() => {
    const key = keyRef.current;
    const h = setTimeout(() => setDraft(key, text), 300);
    return () => clearTimeout(h);
  }, [text]);

  /* ── aksi ── */
  const [searchOn, setSearchOn] = useState(false);
  // "Cari di web" hanya ada untuk model yang mendukungnya (lihat supportsSearch di registry)
  const canSearch = showSearch && Boolean(resolveModel(modelKey)?.supportsSearch);
  const needSearch = canSearch && searchOn;

  const handleSend = () => {
    if (engine.send(text, { needSearch })) {
      setDraft(draftKey, '');
      setText('');
    }
  };

  const handleNew = () => {
    navigate(`/${mode}`);
    setMobileSidebar(false);
    window.dispatchEvent(new Event('ma:focus-composer'));
  };

  const handleDelete = async (c) => {
    const ok = await confirm({
      title: t('convo.delete.title'),
      body: t('convo.delete.body', { title: c.title || t('convo.untitled') }),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    });
    if (!ok) return;
    deleteConversation(c.id);
    toast({ kind: 'info', message: t('convo.deleted'), duration: 2600 });
  };

  const quote = useMemo(() => {
    const quotes = QUOTES[t.lang] || QUOTES.id;
    const day = Math.floor(Date.now() / 86400000);
    return quotes[day % quotes.length];
  }, [t.lang]);

  const empty = (
    <EmptyState
      title={t(`${mode}.empty.title`)}
      body={t(`${mode}.empty.body`)}
      quote={quote}
      hint={
        <Link to={mode === 'chat' ? '/coder' : '/chat'} className="underline decoration-rule-strong underline-offset-4 transition-colors duration-200 hover:text-ink hover:decoration-terracotta">
          {t(mode === 'chat' ? 'chat.empty.coder' : 'coder.empty.chat')}
        </Link>
      }
    />
  );

  const widthClass = wide ? 'max-w-5xl' : 'max-w-3xl';

  return (
    <SaveHintContext.Provider value={conversation?.title || ''}>
    <div className="relative flex h-full min-h-0">
      <ConversationSidebar
        mode={mode}
        conversations={list}
        activeId={conversation?.id || null}
        open={sidebarOpen}
        onClose={closeSidebar}
        onNew={handleNew}
        onDelete={handleDelete}
      />

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-rule px-2 sm:px-3">
          <button
            type="button"
            className="icon-btn"
            onClick={toggleSidebar}
            aria-label={t('convo.toggleSidebar')}
            aria-expanded={sidebarOpen}
            title={t('convo.toggleSidebar')}
          >
            <Icon name="sidebar" size={17} />
          </button>
          <h1 className="min-w-0 flex-1 truncate font-serif text-[0.95rem] text-ink">
            {conversation ? conversation.title || t('convo.untitled') : <span className="italic text-ink-soft">{t('convo.untitled')}</span>}
            <span className="ml-2.5 align-middle text-[0.62rem] uppercase tracking-[0.18em] text-ink-faint">{t(`mode.${mode}`)}</span>
          </h1>

          {boundProject && (
            <A
              href="/files"
              className="btn btn-quiet hidden max-w-[13rem] sm:inline-flex"
              title={`${t('coder.projectChip')}: ${boundProject.name}`}
            >
              <Icon name="folder" size={14} className="shrink-0 text-accent" />
              <span className="truncate">{boundProject.name}</span>
            </A>
          )}

          <select
            className="field hidden !w-auto !py-1 !text-[0.72rem] md:block"
            value={modelKey}
            onChange={(e) => setModelKey(e.target.value)}
            aria-label={t('model.select')}
            title={t('model.select')}
          >
            {TEXT_MODELS.map((m) => (
              <option key={`${m.provider}:${m.id}`} value={`${m.provider}:${m.id}`}>
                {modelLabel(`${m.provider}:${m.id}`)}
              </option>
            ))}
          </select>
          <ExportMenu conversation={conversation} label={mode === 'coder' ? t('coder.export') : undefined} />
          {conversation && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => handleDelete(conversation)}
              aria-label={t('convo.delete')}
              title={t('convo.delete')}
            >
              <Icon name="trash" size={16} />
            </button>
          )}
        </div>

        <MessageList
          conversationKey={conversation?.id || 'new'}
          messages={conversation?.messages || []}
          loading={engine.loading}
          wide={wide}
          mode={mode}
          empty={empty}
          onRegenerate={() => engine.regenerate({ needSearch })}
          onRetry={() => engine.retry({ needSearch })}
        />

        <div className="shrink-0 px-3 pb-3 pt-1 sm:px-6 sm:pb-5">
          <div className={`mx-auto w-full ${widthClass}`}>
            <Composer
              mode={mode}
              value={text}
              onChange={setText}
              onSend={handleSend}
              busy={engine.busy}
              showSearch={canSearch}
              needSearch={needSearch}
              onToggleSearch={() => setSearchOn((v) => !v)}
            />
          </div>
        </div>
      </section>
    </div>
    </SaveHintContext.Provider>
  );
}

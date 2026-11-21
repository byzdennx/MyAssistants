// /vision — halaman khusus multimodal (gambar). Hanya model dengan
// supportsVision yang tampil di dropdown. Semua request lewat /api/chat
// dengan vision:true (server memvalidasi kapabilitas model).
// Gambar dikirim sebagai image_url (data URL hasil upload, atau URL https).
// Menampilkan usage + x-request-id setelah respons.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GlassCard from '../components/GlassCard';
import MarkdownView from '../components/MarkdownView';
import EmptyState from '../components/EmptyState';
import { Icon } from '../components/icons';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { A, navigate } from '../router';
import { useT } from '../lib/i18n';
import { useMediaQuery, useSettings } from '../lib/hooks';
import {
  appendVisionMessage,
  createVisionConversation,
  deleteVisionConversation,
  getVisionConversation,
  getVisionConversations,
  patchVisionConversation,
  updateSettings,
} from '../lib/storage';
import { consumeQuota, getQuota, refundQuota } from '../lib/rateLimit';
import { chatCompletion, describeError, truncateHistory } from '../lib/api';
import { VISION_MODELS, modelLabel, resolveModel } from '../config/providers';
import ImageTools from '../components/ImageTools';
import { truncate, uid, relativeTime, formatTime } from '../lib/utils';
import { useQuotaModal } from '../components/QuotaModal';

const IMAGE_TYPES = ['image/png', 'image/jpg', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('read_failed'));
    reader.readAsDataURL(file);
  });
}

export default function Vision({ route }) {
  const t = useT();
  const settings = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const { openQuota } = useQuotaModal();
  const isMd = useMediaQuery('(min-width: 768px)');

  const id = route.segments[1] || null;
  const [convs, setConvs] = useState(getVisionConversations);
  const conv = useMemo(() => convs.find((c) => c.id === id) || null, [convs, id]);

  useEffect(() => {
    setConvs(getVisionConversations());
  }, [id]);

  useEffect(() => {
    if (id && !conv) navigate('/vision', { replace: true });
  }, [id, conv]);

  // di HP laci daftar percakapan tertutup dulu supaya tidak menutupi halaman
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  const [text, setText] = useState('');
  const [images, setImages] = useState([]); // [{url, name}]
  const [urlInput, setUrlInput] = useState('');
  const [showUrl, setShowUrl] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const scroller = useRef(null);
  const busyRef = useRef(false);

  const modelKey = settings.visionModel;
  const setModelKey = (v) => updateSettings({ visionModel: v });
  // sebagian model (Neko Vision) hanya menerima URL gambar https, bukan unggahan
  const urlOnly = resolveModel(modelKey)?.imageInput === 'url';
  const [mode, setMode] = useState('ask'); // 'ask' = tanya gambar · 'tools' = alat gambar
  const lastPaint = useRef(0);

  useEffect(() => {
    if (urlOnly) setShowUrl(true);
  }, [urlOnly]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conv?.messages?.length, conv?.messages?.at(-1)?.content]);

  const addFiles = async (list) => {
    if (urlOnly) {
      toast({ kind: 'error', message: t('vision.urlOnly') });
      return;
    }
    for (const file of list) {
      if (!IMAGE_TYPES.includes(file.type)) {
        toast({ kind: 'error', message: t('vision.badType', { name: file.name }) });
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast({ kind: 'error', message: t('vision.tooBig', { name: file.name }) });
        continue;
      }
      try {
        const url = await fileToDataUrl(file);
        setImages((prev) => [...prev.slice(-7), { url, name: file.name }]);
      } catch {
        toast({ kind: 'error', message: t('vision.readFail', { name: file.name }) });
      }
    }
  };

  const addUrl = () => {
    const u = urlInput.trim();
    if (!/^https:\/\/\S+/i.test(u)) {
      toast({ kind: 'error', message: t('vision.badUrl') });
      return;
    }
    setImages((prev) => [...prev.slice(-7), { url: u, name: u.split('/').pop().slice(0, 40) }]);
    setUrlInput('');
    setShowUrl(false);
  };

  const send = async () => {
    const prompt = text.trim();
    if ((!prompt && !images.length) || busyRef.current) return;
    if (!navigator.onLine) {
      toast({ kind: 'error', message: t('error.offline') });
      return;
    }
    if (urlOnly && !images.some((i) => /^https:\/\//i.test(i.url))) {
      toast({ kind: 'error', message: t('error.image_url_required') });
      return;
    }
    if (!getQuota().canSend) {
      openQuota();
      return;
    }

    let target = conv;
    if (!target) {
      target = createVisionConversation(truncate(prompt || t('vision.untitledImage'), 40));
      setConvs(getVisionConversations());
      navigate(`/vision/${target.id}`, { replace: true });
    } else if (!target.title && prompt) {
      patchVisionConversation(target.id, { title: truncate(prompt, 40) });
    }

    // susun pesan format OpenAI: content = [text, ...image_url]
    const content = [];
    if (prompt) content.push({ type: 'text', text: prompt });
    images.forEach((img) => content.push({ type: 'image_url', image_url: { url: img.url } }));

    const now = Date.now();
    const userMsg = { id: uid(), role: 'user', content: prompt, images: images.map((i) => i.url), ts: now };
    appendVisionMessage(target.id, userMsg);
    setText('');
    setImages([]);
    setConvs(getVisionConversations());

    const history = truncateHistory(
      getVisionConversation(target.id)
        .messages.filter((m) => m.id !== userMsg.id)
        .map((m) => ({
          role: m.role,
          content:
            m.role === 'user' && m.images?.length
              ? [...(m.content ? [{ type: 'text', text: m.content }] : []), ...m.images.map((u) => ({ type: 'image_url', image_url: { url: u } }))]
              : m.content,
        })),
    );
    const messages = [...history, { role: 'user', content }];

    const stamp = consumeQuota();
    busyRef.current = true;
    setBusy(true);
    const assistantId = uid();
    let full = '';
    appendVisionMessage(target.id, { id: assistantId, role: 'assistant', content: '', ts: now, streaming: true });
    setConvs(getVisionConversations());

    try {
      const res = await chatCompletion({
        modelKey,
        messages,
        stream: true,
        vision: true,
        onChunk: (delta) => {
          full += delta;
          const now2 = Date.now();
          if (now2 - lastPaint.current < 90) return;
          lastPaint.current = now2;
          patchVisionConversation(target.id, (c) => ({
            messages: c.messages.map((m) => (m.id === assistantId ? { ...m, content: full } : m)),
          }));
          setConvs(getVisionConversations());
        },
      });
      patchVisionConversation(target.id, (c) => ({
        messages: c.messages.map((m) =>
          m.id === assistantId ? { ...m, content: res.text, streaming: false, meta: { usage: res.usage, requestId: res.requestId } } : m,
        ),
      }));
      setConvs(getVisionConversations());
    } catch (err) {
      refundQuota(stamp);
      patchVisionConversation(target.id, (c) => ({ messages: c.messages.filter((m) => m.id !== assistantId || m.content) }));
      setConvs(getVisionConversations());
      toast({ kind: 'error', message: describeError(t, err) });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const handleDelete = async (c) => {
    const ok = await confirm({
      title: t('convo.delete.title'),
      body: t('convo.delete.body', { title: c.title || t('vision.untitledImage') }),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    });
    if (!ok) return;
    deleteVisionConversation(c.id);
    setConvs(getVisionConversations());
    toast({ kind: 'info', message: t('convo.deleted'), duration: 2400 });
  };

  const messages = conv?.messages || [];

  return (
    <div className="relative flex h-full min-h-0">
      {sidebarOpen && (
        <>
          <div className="fade-in absolute inset-0 z-20 bg-sepia/35 backdrop-blur-[2px] md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
          <aside className="fade-slide glass-hi absolute inset-y-0 left-0 z-30 flex w-[84vw] max-w-xs flex-col bg-paper/90 md:static md:z-auto md:w-72 md:max-w-none md:shrink-0 md:rounded-none md:border-y-0 md:border-l-0 md:border-r-rule md:bg-transparent md:shadow-none">
            <div className="flex items-center gap-2 border-b border-rule p-3">
              <button
                type="button"
                className="btn btn-ink flex-1"
                onClick={() => {
                  navigate('/vision');
                  setSidebarOpen(false);
                }}
              >
                <Icon name="plus" size={14} />
                {t('vision.new')}
              </button>
              <button type="button" className="icon-btn md:hidden" onClick={() => setSidebarOpen(false)} aria-label={t('common.close')}>
                <Icon name="x" size={16} />
              </button>
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3" aria-label={t('vision.list')}>
              {convs.length === 0 ? (
                <p className="px-3 py-6 text-center font-serif text-sm italic text-ink-faint">{t('convo.none')}</p>
              ) : (
                <ul className="space-y-0.5">
                  {convs.map((c) => (
                    <li key={c.id} className="group relative">
                      <A
                        href={`/vision/${c.id}`}
                        aria-current={c.id === conv?.id ? 'page' : undefined}
                        className={`block rounded-sm border-l-2 py-2 pl-3 pr-9 transition-colors duration-200 ${
                          c.id === conv?.id ? 'border-terracotta bg-ink/[0.07]' : 'border-transparent hover:bg-ink/[0.04]'
                        }`}
                      >
                        <span className="block truncate font-serif text-[0.9rem] leading-snug text-ink">{c.title || t('vision.untitledImage')}</span>
                        <span className="mt-0.5 block text-[0.68rem] text-ink-faint">{relativeTime(c.updatedAt, t.lang)}</span>
                      </A>
                      <button
                        type="button"
                        onClick={() => handleDelete(c)}
                        aria-label={`${t('convo.delete')}: ${c.title}`}
                        className="icon-btn absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 opacity-100 md:opacity-0 md:focus:opacity-100 md:group-hover:opacity-100"
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </nav>
          </aside>
        </>
      )}

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-rule px-2 sm:px-3">
          <button type="button" className="icon-btn" onClick={() => setSidebarOpen((v) => !v)} aria-label={t('convo.toggleSidebar')} aria-expanded={sidebarOpen}>
            <Icon name="sidebar" size={17} />
          </button>
          <h1 className="min-w-0 flex-1 truncate font-serif text-[0.95rem] text-ink">
            {conv ? conv.title || t('vision.untitledImage') : <span className="italic text-ink-soft">{t('vision.untitledImage')}</span>}
            <span className="ml-2.5 align-middle text-[0.62rem] uppercase tracking-[0.18em] text-ink-faint">{t('nav.vision')}</span>
          </h1>
          <div className="seg" role="group" aria-label={t('vision.mode')}>
            <button type="button" aria-pressed={mode === 'ask'} onClick={() => setMode('ask')}>
              {t('vision.mode.ask')}
            </button>
            <button type="button" aria-pressed={mode === 'tools'} onClick={() => setMode('tools')}>
              {t('vision.mode.tools')}
            </button>
          </div>
          <select
            className={`field !w-auto max-w-[9rem] !py-1 !text-[0.72rem] sm:max-w-none ${mode === 'tools' ? 'hidden' : ''}`}
            value={modelKey}
            onChange={(e) => setModelKey(e.target.value)}
            aria-label={t('model.select')}
            title={t('model.select')}
          >
            {VISION_MODELS.map((m) => (
              <option key={`${m.provider}:${m.id}`} value={`${m.provider}:${m.id}`}>
                {modelLabel(`${m.provider}:${m.id}`)}
              </option>
            ))}
          </select>
        </div>

        {mode === 'tools' && <ImageTools />}

        <div ref={scroller} className={`min-h-0 flex-1 overflow-y-auto ${mode === 'tools' ? 'hidden' : ''}`} role="log">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
            {messages.length === 0 && !busy && (
              <EmptyState
                title={t('vision.empty.title')}
                body={t('vision.empty.body')}
                hint={
                  <p className="text-sm text-ink-soft">{t('vision.empty.hint')}</p>
                }
              />
            )}
            {messages.map((m) =>
              m.role === 'user' ? (
                <article key={m.id} className="fade-slide flex flex-col items-end gap-1.5">
                  <p className="eyebrow flex items-center gap-2 pr-0.5">
                    <span>{t('convo.you')}</span>
                    <time>{formatTime(m.ts, t.lang)}</time>
                  </p>
                  <div className="max-w-[88%] rounded-md rounded-br-none bg-bubble-user px-4 py-3 text-[0.93rem] text-bubble-ink sm:max-w-[80%]">
                    {m.images?.length > 0 && (
                      <div className="mb-2 flex flex-wrap justify-end gap-2">
                        {m.images.map((u, i) => (
                          <img key={i} src={u} alt="" className="h-20 w-20 rounded-sm border border-white/20 object-cover" />
                        ))}
                      </div>
                    )}
                    {m.content}
                  </div>
                </article>
              ) : (
                <article key={m.id} className="fade-slide flex flex-col items-start gap-1.5">
                  <p className="eyebrow flex items-center gap-2 pl-0.5">
                    <span aria-hidden="true" className="inline-block h-1.5 w-1.5 bg-terracotta" />
                    <span>MyAssistants</span>
                    <time>{formatTime(m.ts, t.lang)}</time>
                  </p>
                  <div className="glass w-full rounded-md rounded-bl-none px-4 py-3.5 sm:max-w-[88%] sm:px-5">
                    {m.content.trim() ? <MarkdownView text={m.content} /> : null}
                    {m.streaming && <span className="type-caret" aria-hidden="true" />}
                    {m.meta && !m.streaming && (
                      <p className="mt-3 border-t border-rule pt-2 font-mono text-[0.64rem] leading-relaxed text-ink-faint">
                        {m.meta.usage
                          ? `↑ ${m.meta.usage.prompt_tokens ?? '?'} ↓ ${m.meta.usage.completion_tokens ?? '?'} token`
                          : null}
                        {m.meta.requestId ? ` · x-request-id: ${m.meta.requestId}` : null}
                      </p>
                    )}
                  </div>
                </article>
              ),
            )}
            {busy && messages.at(-1)?.role !== 'assistant' && (
              <article className="fade-in flex flex-col items-start gap-1.5">
                <p className="eyebrow pl-0.5">MyAssistants</p>
                <div className="glass rounded-md rounded-bl-none px-5 py-3.5">
                  <span className="font-serif text-sm italic text-ink-soft">{t('vision.thinking')}</span>
                </div>
              </article>
            )}
          </div>
        </div>

        <div className={`shrink-0 px-3 pb-3 pt-1 sm:px-6 sm:pb-5 ${mode === 'tools' ? 'hidden' : ''}`}>
          <div className="mx-auto w-full max-w-3xl">
            <div className="glass-hi rounded-md p-2.5 focus-within:border-terracotta sm:p-3">
              {images.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {images.map((img, i) => (
                    <span key={i} className="group relative block h-16 w-16 overflow-hidden rounded-sm border border-rule-strong">
                      <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                        aria-label={t('vision.removeImage')}
                        className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-sm bg-ink/80 text-paper opacity-90 hover:opacity-100"
                      >
                        <Icon name="x" size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {urlOnly && <p className="mb-2 px-2 font-serif text-xs italic text-ink-faint">{t('vision.urlOnly')}</p>}
              {showUrl && (
                <div className="mb-2 flex gap-2">
                  <input
                    className="field !py-1.5 !text-[0.8rem]"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())}
                    placeholder="https://contoh.com/gambar.png"
                    aria-label={t('vision.urlLabel')}
                  />
                  <button type="button" className="btn btn-line !py-1.5" onClick={addUrl}>
                    {t('vision.addUrl')}
                  </button>
                </div>
              )}
              <textarea
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t('vision.placeholder')}
                aria-label={t('vision.placeholder')}
                className="composer-input block max-h-40 w-full resize-none border-0 bg-transparent px-2 py-1.5 text-[0.95rem] text-ink outline-none placeholder:text-ink-faint"
              />
              <div className="mt-1.5 flex items-center gap-2 border-t border-rule pt-2.5">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => {
                    addFiles([...(e.target.files || [])]);
                    e.target.value = '';
                  }}
                />
                <button type="button" className="btn btn-quiet" onClick={() => fileRef.current?.click()} disabled={urlOnly} title={t('vision.upload')} aria-label={t('vision.upload')}>
                  <Icon name="upload" size={14} />
                  <span className="hidden sm:inline">{t('vision.upload')}</span>
                </button>
                <button type="button" className="btn btn-quiet" onClick={() => setShowUrl((v) => !v)} aria-pressed={showUrl} title={t('vision.urlLabel')}>
                  <Icon name="globe" size={14} />
                  <span className="hidden sm:inline">URL</span>
                </button>
                <span className="flex-1" />
                <button type="button" className="btn btn-ink" disabled={busy || (!text.trim() && !images.length)} onClick={send}>
                  <Icon name="send" size={14} />
                  {t('composer.send')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

import { useEffect, useLayoutEffect, useRef } from 'react';
import ChatBubble, { ThinkingBubble } from './ChatBubble';
import { Icon } from './icons';
import { useT } from '../lib/i18n';

// Daftar pesan + auto-scroll yang "menempel" ke bawah (kecuali user scroll ke atas).
export default function MessageList({ conversationKey, messages, loading, wide, mode = 'chat', onRegenerate, onRetry, empty }) {
  const t = useT();
  const scroller = useRef(null);
  const content = useRef(null);
  const stick = useRef(true);

  // ganti percakapan → langsung ke bawah
  useLayoutEffect(() => {
    stick.current = true;
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversationKey]);

  // pesan user baru → tempel lagi
  const last = messages[messages.length - 1];
  useEffect(() => {
    if (last?.role === 'user') stick.current = true;
  }, [last?.id, last?.role]);

  // isi bertambah (typewriter / balasan baru) → ikuti
  useEffect(() => {
    const el = scroller.current;
    const inner = content.current;
    if (!el || !inner || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      if (stick.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
  };

  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'assistant') return i;
    return -1;
  })();
  const needsRetry = !loading && last?.role === 'user' && !last.local;

  return (
    <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" role="log" aria-live="off">
      <div ref={content} className={`mx-auto flex w-full flex-col gap-6 px-4 pb-6 pt-6 sm:px-6 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
        {messages.length === 0 && !loading && empty}
        {messages.map((m, i) => (
          <ChatBubble
            key={m.id}
            message={m}
            wide={wide}
            mode={mode}
            canRegenerate={!loading && i === messages.length - 1 && i === lastAssistantIdx && !m.local}
            onRegenerate={onRegenerate}
          />
        ))}
        {loading && <ThinkingBubble wide={wide} mode={mode} />}
        {needsRetry && (
          <div className="fade-in flex items-center justify-end gap-2 text-xs text-ink-faint">
            <span className="font-serif italic">{t('convo.noReply')}</span>
            <button type="button" className="btn btn-quiet" onClick={onRetry}>
              <Icon name="refresh" size={13} />
              {t('convo.retry')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

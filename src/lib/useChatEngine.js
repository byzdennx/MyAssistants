// Mesin percakapan Chat — semua request lewat /api/chat (key milik server),
// model dari registry (settings.chatModel), streaming SSE dengan update bertahap.

import { useCallback, useRef, useState } from 'react';
import {
  appendMessage,
  createConversation,
  getConversation,
  getSettings,
  patchConversation,
  recordActivity,
} from './storage';
import { consumeQuota, getQuota, refundQuota } from './rateLimit';
import { chatCompletion, describeError, truncateHistory } from './api';
import { containsCode } from './markdown';
import { wantsCode } from './intent';
import { truncate, uid } from './utils';
import { useT } from './i18n';
import { navigate } from '../router';
import { useToast } from '../components/Toast';
import { useQuotaModal } from '../components/QuotaModal';
import { CHAT_CODE_STRIPPED, CHAT_SYSTEM_PROMPT, REDIRECT_TO_CODER } from '../prompts';

export function useChatEngine({ conversationId }) {
  const t = useT();
  const toast = useToast();
  const { openQuota } = useQuotaModal();
  const [loadingId, setLoadingId] = useState(null);
  const busy = useRef(false);
  const throttle = useRef(0);

  const reportError = useCallback(
    (err) => toast({ kind: 'error', message: describeError(t, err) }),
    [t, toast],
  );

  const request = useCallback(
    async (convId, { needSearch = false } = {}) => {
      const conv = getConversation(convId);
      if (conv?.mode !== 'chat') return;

      let lastUser = -1;
      for (let i = conv.messages.length - 1; i >= 0; i--) {
        if (conv.messages[i].role === 'user' && !conv.messages[i].local) {
          lastUser = i;
          break;
        }
      }
      if (lastUser === -1) return;

      const userMsg = conv.messages[lastUser];
      const history = truncateHistory(
        conv.messages.slice(0, lastUser).filter((m) => !m.local).map((m) => ({ role: m.role, content: m.content })),
      );
      const messages = [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...history, { role: 'user', content: userMsg.content }];

      const stamp = consumeQuota();
      busy.current = true;
      setLoadingId(convId);

      const assistantId = uid();
      // placeholder kosong, diisi bertahap saat chunk SSE masuk
      patchConversation(convId, (c) => {
        const at = c.messages.findIndex((m) => m.id === userMsg.id);
        const kept = at === -1 ? c.messages : c.messages.slice(0, at + 1);
        return { messages: [...kept, { id: assistantId, role: 'assistant', content: '', ts: Date.now(), streaming: true }], updatedAt: Date.now() };
      });

      let text = '';
      try {
        const res = await chatCompletion({
          modelKey: getSettings().chatModel,
          messages,
          stream: true,
          needSearch,
          onChunk: (delta) => {
            text += delta;
            const now = Date.now();
            if (now - throttle.current < 90) return; // update UI maks tiap 90 ms
            throttle.current = now;
            patchConversation(convId, (c) => ({
              messages: c.messages.map((m) => (m.id === assistantId ? { ...m, content: text } : m)),
            }));
          },
        });

        text = res.text.trim();
        // Chat tidak boleh mengeluarkan blok kode, apa pun kata modelnya.
        if (containsCode(text)) text = CHAT_CODE_STRIPPED;

        patchConversation(convId, (c) => ({
          messages: c.messages.map((m) =>
            m.id === assistantId ? { ...m, content: text, streaming: false, meta: { usage: res.usage, requestId: res.requestId } } : m,
          ),
          updatedAt: Date.now(),
        }));
      } catch (err) {
        refundQuota(stamp);
        // hapus placeholder kalau gagal total
        patchConversation(convId, (c) => ({
          messages: c.messages.filter((m) => m.id !== assistantId || m.content),
        }));
        reportError(err);
      } finally {
        busy.current = false;
        setLoadingId(null);
      }
    },
    [reportError],
  );

  const ensureConversation = useCallback(
    (firstText) => {
      let conv = conversationId ? getConversation(conversationId) : null;
      if (conv && conv.mode !== 'chat') conv = null;
      if (!conv) {
        conv = createConversation({ title: truncate(firstText, 40) });
        navigate(`/chat/${conv.id}`, { replace: true });
      } else if (!conv.title) {
        patchConversation(conv.id, { title: truncate(firstText, 40) });
      }
      return conv;
    },
    [conversationId],
  );

  const send = useCallback(
    (raw, { needSearch = false } = {}) => {
      const text = String(raw || '').trim();
      if (!text || busy.current) return false;
      if (!navigator.onLine) {
        toast({ kind: 'error', message: t('error.offline') });
        return false;
      }

      // Penjaga mode — dibalas lokal, tanpa API dan tanpa memotong kuota.
      if (wantsCode(text)) {
        const conv = ensureConversation(text);
        const now = Date.now();
        appendMessage(conv.id, { id: uid(), role: 'user', content: text, ts: now, local: true });
        appendMessage(conv.id, { id: uid(), role: 'assistant', content: REDIRECT_TO_CODER, ts: now + 1, local: true });
        return true;
      }

      if (!getQuota().canSend) {
        openQuota();
        return false;
      }

      const conv = ensureConversation(text);
      appendMessage(conv.id, { id: uid(), role: 'user', content: text, ts: Date.now() });
      recordActivity();
      request(conv.id, { needSearch });
      return true;
    },
    [ensureConversation, openQuota, request, t, toast],
  );

  const resend = useCallback(
    ({ needSearch = false } = {}) => {
      if (busy.current || !conversationId) return;
      if (!navigator.onLine) {
        toast({ kind: 'error', message: t('error.offline') });
        return;
      }
      if (!getQuota().canSend) {
        openQuota();
        return;
      }
      request(conversationId, { needSearch });
    },
    [conversationId, openQuota, request, t, toast],
  );

  return {
    send,
    regenerate: resend,
    retry: resend,
    loading: loadingId !== null && loadingId === conversationId,
    busy: loadingId !== null,
  };
}

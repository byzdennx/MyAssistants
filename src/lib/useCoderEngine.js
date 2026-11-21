// Mesin halaman Coder — lewat /api/chat (key server), model dari settings.coderModel.
// Setiap balasan ber-code: dipecah per file → AUTO-TERSIMPAN ke proyek → bubble hanya
// menampilkan penjelasan + daftar "membuat file <path>".
// Streaming SSE: bubble diisi bertahap.

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
import { isCasualTalk } from './intent';
import { contentBytes, MAX_ENTITY_BYTES, truncate, uid } from './utils';
import { useT } from './i18n';
import { navigate } from '../router';
import { useToast } from '../components/Toast';
import { useQuotaModal } from '../components/QuotaModal';
import { REDIRECT_TO_CHAT } from '../prompts';
import { extractCoderFiles, stripCodeBlocks } from './markdown';
import { FilesError, ensureProjectByName, getProject, saveFilesToProject } from './files';
import { suggestProjectName } from '../components/SaveFilesModal';

export function useCoderEngine({ conversationId }) {
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

  const ensureProject = useCallback((conv) => {
    let project = conv.projectId ? getProject(conv.projectId) : null;
    if (!project) project = ensureProjectByName(suggestProjectName(conv.title));
    if (conv.projectId !== project.id) patchConversation(conv.id, { projectId: project.id });
    return project;
  }, []);

  const request = useCallback(
    async (convId) => {
      const conv = getConversation(convId);
      if (conv?.mode !== 'coder') return;

      let lastUser = -1;
      for (let i = conv.messages.length - 1; i >= 0; i--) {
        if (conv.messages[i].role === 'user' && !conv.messages[i].local) {
          lastUser = i;
          break;
        }
      }
      if (lastUser === -1) return;

      const userMsg = conv.messages[lastUser];
      // Riwayat multi-turn; balasan lama dikirim versi tanpa kode (hemat token).
      const history = truncateHistory(
        conv.messages
          .slice(0, lastUser)
          .filter((m) => !m.local)
          .map((m) => ({ role: m.role, content: m.role === 'assistant' ? m.codeFree ?? m.content : m.content })),
      );
      const messages = [...history, { role: 'user', content: userMsg.content }];

      const stamp = consumeQuota();
      busy.current = true;
      setLoadingId(convId);

      const assistantId = uid();
      let full = '';
      patchConversation(convId, (c) => {
        const at = c.messages.findIndex((m) => m.id === userMsg.id);
        const kept = at === -1 ? c.messages : c.messages.slice(0, at + 1);
        return { messages: [...kept, { id: assistantId, role: 'assistant', content: '', ts: Date.now(), streaming: true }], updatedAt: Date.now() };
      });

      try {
        const res = await chatCompletion({
          modelKey: getSettings().coderModel,
          messages,
          stream: true,
          onChunk: (delta) => {
            full += delta;
            const now = Date.now();
            if (now - throttle.current < 120) return;
            throttle.current = now;
            // saat streaming, tampilkan versi tanpa blok kode
            patchConversation(convId, (c) => ({
              messages: c.messages.map((m) => (m.id === assistantId ? { ...m, content: full, codeFree: stripCodeBlocks(full) } : m)),
            }));
          },
        });

        full = res.text;
        const codeFree = stripCodeBlocks(full);
        const files = extractCoderFiles(full);

        // AUTO-SAVE ke proyek yang terikat pada percakapan.
        let projectName = '';
        if (files.length) {
          try {
            const fresh = getConversation(convId);
            const project = ensureProject(fresh);
            saveFilesToProject({ projectName: project.name, files });
            projectName = project.name;
          } catch (err) {
            if (err instanceof FilesError) toast({ kind: 'error', message: t(`files.err.${err.code}`) });
          }
        }

        patchConversation(convId, (c) => ({
          messages: c.messages.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: full,
                  codeFree,
                  streaming: false,
                  meta: { usage: res.usage, requestId: res.requestId },
                  ...(files.length ? { files: files.map((f) => ({ ...f, bytes: contentBytes(f.content) })), filesProject: projectName } : {}),
                }
              : m,
          ),
          updatedAt: Date.now(),
        }));

        if (files.length) {
          toast({
            kind: 'success',
            message: t('coder.savedFiles', { n: files.length, name: projectName }),
            action: { label: t('save.open'), onClick: () => navigate('/files') },
          });
        }
      } catch (err) {
        refundQuota(stamp);
        patchConversation(convId, (c) => ({ messages: c.messages.filter((m) => m.id !== assistantId || m.content) }));
        reportError(err);
      } finally {
        busy.current = false;
        setLoadingId(null);
      }
    },
    [ensureProject, reportError, t, toast],
  );

  const ensureConversation = useCallback(
    (firstText) => {
      let conv = conversationId ? getConversation(conversationId) : null;
      if (conv && conv.mode !== 'coder') conv = null;
      if (!conv) {
        conv = createConversation({ mode: 'coder', title: truncate(firstText, 40) });
        navigate(`/coder/${conv.id}`, { replace: true });
      } else if (!conv.title) {
        patchConversation(conv.id, { title: truncate(firstText, 40) });
      }
      return conv;
    },
    [conversationId],
  );

  const send = useCallback(
    (raw) => {
      const text = String(raw || '').trim();
      if (!text || busy.current) return false;
      if (!navigator.onLine) {
        toast({ kind: 'error', message: t('error.offline') });
        return false;
      }

      const existing = conversationId ? getConversation(conversationId) : null;
      const inConversation = Boolean(existing && existing.messages.some((m) => m.role === 'assistant'));
      if (isCasualTalk(text, { inConversation })) {
        const conv = ensureConversation(text);
        const now = Date.now();
        appendMessage(conv.id, { id: uid(), role: 'user', content: text, ts: now, local: true });
        appendMessage(conv.id, { id: uid(), role: 'assistant', content: REDIRECT_TO_CHAT, codeFree: REDIRECT_TO_CHAT, ts: now + 1, local: true });
        return true;
      }

      if (!getQuota().canSend) {
        openQuota();
        return false;
      }

      const conv = ensureConversation(text);
      if (conv.messages.reduce((n, m) => n + contentBytes(m.content), 0) + contentBytes(text) > MAX_ENTITY_BYTES) {
        toast({ kind: 'error', message: t('error.chat_too_large') });
        return false;
      }
      appendMessage(conv.id, { id: uid(), role: 'user', content: text, ts: Date.now() });
      recordActivity();
      request(conv.id);
      return true;
    },
    [conversationId, ensureConversation, openQuota, request, t, toast],
  );

  const resend = useCallback(() => {
    if (busy.current || !conversationId) return;
    if (!navigator.onLine) {
      toast({ kind: 'error', message: t('error.offline') });
      return;
    }
    if (!getQuota().canSend) {
      openQuota();
      return;
    }
    request(conversationId);
  }, [conversationId, openQuota, request, t, toast]);

  return {
    send,
    regenerate: resend,
    retry: resend,
    loading: loadingId !== null && loadingId === conversationId,
    busy: loadingId !== null,
  };
}

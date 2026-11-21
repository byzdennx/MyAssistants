import { createContext, useCallback, useContext, useState, useSyncExternalStore } from 'react';
import Modal from './Modal';
import QuotaPips from './QuotaPips';
import { useT } from '../lib/i18n';
import { useNow } from '../lib/hooks';
import { subscribe, getRate } from '../lib/storage';
import { computeQuota, formatCountdown, LIMIT } from '../lib/rateLimit';

const QuotaContext = createContext({ openQuota: () => {} });

export function useQuotaModal() {
  return useContext(QuotaContext);
}

export function QuotaModalProvider({ children }) {
  const [open, setOpen] = useState(false);
  const openQuota = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  return (
    <QuotaContext.Provider value={{ openQuota }}>
      {children}
      <Modal open={open} onClose={close} labelledBy="quota-title" maxWidth="max-w-lg">
        <QuotaBody onClose={close} />
      </Modal>
    </QuotaContext.Provider>
  );
}

// Dirender hanya saat modal terbuka, jadi timer 1 detik tidak jalan di latar.
function QuotaBody({ onClose }) {
  const t = useT();
  const rate = useSyncExternalStore(subscribe, getRate, getRate);
  const now = useNow(1000);
  const q = computeQuota(rate.timestamps, now);
  const cd = formatCountdown(q.resetAt ? q.resetAt - now : 0);

  return (
    <div className="glass-hi rounded-lg px-7 pb-8 pt-8 sm:px-10">
      <div className="flex items-center justify-between">
        <p className="eyebrow">{t('quota.label')}</p>
        <QuotaPips remaining={q.remaining} limit={LIMIT} />
      </div>

      <h2 id="quota-title" className="mt-6 font-display text-[2.1rem] italic leading-[1.1] letterpress">
        {q.canSend ? t('quotaModal.back') : t('quotaModal.title')}
      </h2>

      {!q.canSend && (
        <>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">{t('quotaModal.body', { limit: LIMIT })}</p>

          <div className="mt-7 border-y-[3px] border-double border-rule-strong py-5" role="timer" aria-live="off">
            <div className="flex items-start justify-center gap-3 sm:gap-5">
              {[
                [cd.h, 'quotaModal.h'],
                [cd.m, 'quotaModal.m'],
                [cd.s, 'quotaModal.s'],
              ].map(([value, label], i) => (
                <div key={label} className="flex items-start gap-3 sm:gap-5">
                  {i > 0 && <span className="pt-1 font-display text-5xl leading-none text-terracotta sm:text-6xl">:</span>}
                  <div className="text-center">
                    <div className="font-display text-5xl leading-none tabular-nums letterpress sm:text-6xl">{value}</div>
                    <div className="eyebrow mt-3">{t(label)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-5 font-serif text-xs italic leading-relaxed text-ink-faint">{t('quotaModal.note')}</p>
        </>
      )}

      <div className="mt-7 flex justify-end">
        <button type="button" data-autofocus className="btn btn-ink" onClick={onClose}>
          {t('quotaModal.ok')}
        </button>
      </div>
    </div>
  );
}

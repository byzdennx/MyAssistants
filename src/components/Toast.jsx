import { createContext, useCallback, useContext, useState } from 'react';
import { Icon } from './icons';
import { uid } from '../lib/utils';
import { useT } from '../lib/i18n';

// Toast vintage: secarik kertas kraft dengan jahitan putus-putus. Bukan kartu berwarna.
const ToastContext = createContext(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const t = useT();
  const [items, setItems] = useState([]);

  const dismiss = useCallback((id) => setItems((list) => list.filter((x) => x.id !== id)), []);

  const push = useCallback(
    ({ kind = 'info', title, message, action, duration = 5200 }) => {
      const id = uid();
      setItems((list) => [...list.slice(-3), { id, kind, title, message, action }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-3 bottom-[4.75rem] z-[110] flex flex-col items-end gap-2.5 md:inset-x-auto md:bottom-6 md:right-6 md:w-[23rem]"
        role="status"
        aria-live="polite"
      >
        {items.map((item) => (
          <div key={item.id} className="toast slide-in-right pointer-events-auto w-full py-3 pl-4 pr-10" data-kind={item.kind}>
            <p className="eyebrow" style={{ color: 'inherit', opacity: 0.65 }}>
              {item.title || t(`toast.kind.${item.kind}`)}
            </p>
            <p className="mt-1.5 text-[0.86rem] leading-snug">{item.message}</p>
            {item.action && (
              <button
                type="button"
                onClick={() => {
                  item.action.onClick();
                  dismiss(item.id);
                }}
                className="relative mt-2 text-[0.8rem] font-medium underline decoration-1 underline-offset-4 hover:decoration-2"
              >
                {item.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-sm opacity-60 transition-opacity hover:opacity-100"
              aria-label={t('toast.dismiss')}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Cangkang modal: overlay, Esc untuk menutup, kunci scroll, fokus dikembalikan.
export default function Modal({ open, onClose, labelledBy, dismissible = true, children, maxWidth = 'max-w-md' }) {
  const ref = useRef(null);
  // onClose lewat ref: effect di bawah hanya jalan saat modal dibuka/ditutup,
  // bukan tiap render (kalau tidak, fokus terus dikembalikan ke tombol pemicu).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation();
        closeRef.current?.();
      }
    };
    window.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => {
      const target = ref.current?.querySelector('[data-autofocus]') || ref.current;
      target?.focus?.();
    });
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(raf);
      previous?.focus?.();
    };
  }, [open, dismissible]);

  if (!open) return null;

  return createPortal(
    <div className="fade-in fixed inset-0 z-[100] grid place-items-center overflow-y-auto p-4">
      <div
        className="absolute inset-0 bg-sepia/45 backdrop-blur-[3px]"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`fade-slide relative z-10 my-auto w-full ${maxWidth} outline-none`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

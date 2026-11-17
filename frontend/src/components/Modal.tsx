import { useEffect, useRef, type ReactNode } from 'react';

/** Native modal: traps focus, makes the background inert and restores the opener. */
export function Modal({ children, titleId, onClose, className = '', busy = false }: {
  children: ReactNode; titleId: string; onClose: () => void; className?: string; busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = overflow; opener?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} aria-busy={busy}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onKeyDown={(event) => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
      )).filter((element) => element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    className={`m-auto max-h-[90dvh] w-[calc(100%-2rem)] overflow-auto rounded-2xl bg-white p-0 text-slate-800 shadow-xl backdrop:bg-black/60 ${className}`}>
    {children}
  </dialog>;
}

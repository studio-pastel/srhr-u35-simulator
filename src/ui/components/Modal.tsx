import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

/** 開いているモーダルの「閉じる」。Esc キーはまずここを閉じる（§8.1） */
export const modalStack: (() => void)[] = [];

/** Tab キーのフォーカスを、モーダルの中で循環させる */
function trapFocus(e: KeyboardEvent): void {
  if (e.key !== 'Tab') return;
  const root = e.currentTarget as HTMLElement;
  const items = [...root.querySelectorAll<HTMLElement>('button, a[href], summary, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.hasAttribute('disabled'));
  if (items.length === 0) return;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/** 下から出るシート */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const close = () => closeRef.current();
    modalStack.push(close);
    ref.current?.focus();
    return () => {
      const i = modalStack.lastIndexOf(close);
      if (i >= 0) modalStack.splice(i, 1);
      before?.focus?.();
    };
  }, []);
  return (
    <div class="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1} ref={ref} onKeyDown={trapFocus}>
        <h2 id="modal-title" style={{ marginTop: 0 }}>
          {title}
        </h2>
        {children}
        <button type="button" class="btn primary" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
}

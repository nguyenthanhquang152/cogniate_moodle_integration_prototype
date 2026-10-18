import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "./button.tsx";
import { X } from "lucide-react";

export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement;
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      data-slot="dialog"
      className="fixed m-auto w-[min(560px,calc(100vw-40px))] max-h-[calc(100vh-48px)] overflow-auto text-[#f4effb] shadow-[0_20px_100px_#0008] backdrop:bg-[#09070ed9] backdrop:backdrop-blur-[4px] [&>*+*]:mt-[22px] rounded-card border border-card-border bg-card p-[26px] max-[720px]:p-5"
      ref={ref}
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
    >
      <div className="flex items-center justify-between gap-5 [&>div:first-child]:min-w-0 max-[720px]:flex-wrap max-[720px]:items-start">
        <h2 id={titleId}>{title}</h2>
        <Button
          variant="icon"
          type="button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </Button>
      </div>
      {children}
    </dialog>
  );
}

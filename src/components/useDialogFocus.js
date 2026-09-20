import { useEffect, useRef } from "react";

const focusableSelector = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export default function useDialogFocus(onClose) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const focusable = () => [...dialog.querySelectorAll(focusableSelector)].filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "Tab") {
        const controls = focusable();
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const returnTarget = previousFocus?.isConnected
        ? previousFocus
        : document.querySelector(".profile-button, .tab-nav .active, .main-content button");
      returnTarget?.focus?.();
    };
  }, [onClose]);

  return dialogRef;
}

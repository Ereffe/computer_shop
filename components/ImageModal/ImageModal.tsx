"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type ImageModalProps = {
  title: string;
  children: React.ReactNode;
};

const ImageModal = ({ title, children }: ImageModalProps) => {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog?.open) {
        dialog.close();
      }
      if (opener?.isConnected) {
        opener.focus();
      }
    };
  }, []);

  const close = () => {
    router.back();
  };

  return (
    <dialog
      ref={dialogRef}
      className="image-modal"
      aria-labelledby="image-modal-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <div className="image-modal-content">
        <div className="image-modal-header">
          <h2 id="image-modal-title">{title}</h2>

          <button type="button" className="image-modal-close" onClick={close}>
            Zamknij
          </button>
        </div>

        <div className="image-modal-image">{children}</div>
      </div>
    </dialog>
  );
};

export default ImageModal;

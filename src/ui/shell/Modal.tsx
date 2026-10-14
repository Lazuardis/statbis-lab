import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { useT } from '../../i18n/i18n';
import { CloseIcon } from './icons';

/** A native modal dialog: Esc and a click on the backdrop close it, focus stays inside. */
export function Modal(props: {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  footer?: ComponentChildren;
  size?: 'small' | 'medium' | 'large';
}) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      class={`modal modal-${props.size ?? 'medium'}`}
      aria-label={props.title}
      onCancel={(e) => {
        e.preventDefault();
        props.onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) props.onClose();
      }}
    >
      <div class="modal-inner">
        <div class="modal-head">
          <h2>{props.title}</h2>
          <button type="button" class="icon-btn" aria-label={t('common.close')} onClick={props.onClose}>
            <CloseIcon />
          </button>
        </div>
        <div class="modal-body">{props.children}</div>
        {props.footer && <div class="modal-foot">{props.footer}</div>}
      </div>
    </dialog>
  );
}

export function ConfirmDialog(props: {
  title: string;
  body: string[];
  okLabel: string;
  onAnswer: (ok: boolean) => void;
}) {
  const t = useT();
  return (
    <Modal
      title={props.title}
      size="small"
      onClose={() => props.onAnswer(false)}
      footer={
        <>
          <button type="button" class="btn" onClick={() => props.onAnswer(false)}>
            {t('common.cancel')}
          </button>
          <button type="button" class="btn btn-primary" autofocus onClick={() => props.onAnswer(true)}>
            {props.okLabel}
          </button>
        </>
      }
    >
      {props.body.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </Modal>
  );
}

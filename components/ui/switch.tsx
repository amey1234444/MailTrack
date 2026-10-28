'use client';
import { useState } from 'react';
/** Visual adaptation of cssbuttons-io/mean-dolphin-24 (MIT). See THIRD_PARTY_NOTICES.md. */
export default function Switch({
  checked,
  onCheckedChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void | Promise<void>;
  label: string;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={pending}
      disabled={disabled || pending}
      className="mt-switch"
      onClick={async () => {
        setPending(true);
        try {
          await onCheckedChange(!checked);
        } finally {
          setPending(false);
        }
      }}
    >
      <span className="mt-switch-border" aria-hidden="true">
        <span className="mt-switch-track">
          <span className="mt-switch-handle" />
        </span>
      </span>
      <span className="mt-switch-copy">
        {label}
        <small>{pending ? 'Updating…' : checked ? 'On' : 'Off'}</small>
      </span>
    </button>
  );
}

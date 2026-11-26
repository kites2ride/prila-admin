import { useEffect, useRef, useState } from 'react';
import ParticleButton, { type ParticleButtonStatus } from './fx/ParticleButton';

/**
 * Drop-in "Save changes" button: shows saving, then a check + particle burst on success or a shake on
 * failure. Driven by the page's own `saving` / error state, so no save logic changes.
 */
export function SaveButton({
  saving,
  failed,
  disabled,
  onClick,
  children = 'Save changes',
}: {
  saving: boolean;
  failed: boolean;
  disabled?: boolean;
  onClick: () => void;
  children?: string;
}) {
  const [status, setStatus] = useState<ParticleButtonStatus>('idle');
  const wasSaving = useRef(false);

  useEffect(() => {
    if (saving) {
      wasSaving.current = true;
      setStatus('pending');
      return;
    }
    if (!wasSaving.current) return;
    wasSaving.current = false;
    setStatus(failed ? 'error' : 'success');
    const t = window.setTimeout(() => setStatus('idle'), failed ? 2400 : 1600);
    return () => window.clearTimeout(t);
  }, [saving, failed]);

  return (
    <ParticleButton
      type="button"
      status={status}
      disabled={status === 'idle' ? disabled : false}
      onClick={() => {
        if (status === 'idle') onClick();
      }}
      pendingLabel="Saving"
      successLabel="Saved"
      errorLabel="Not saved"
    >
      {children}
    </ParticleButton>
  );
}

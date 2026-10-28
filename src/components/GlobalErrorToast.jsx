import React from 'react';
import { CircleHelp, X } from 'lucide-react';

export function GlobalErrorToast({ notification, onDismiss }) {
  if (!notification) return null;
  return (
    <div className="global-error-toast" role="alert" aria-live="assertive">
      <CircleHelp size={18} />
      <span>{notification.message}</span>
      <button type="button" aria-label="Dismiss error notification" onClick={onDismiss}><X size={16} /></button>
    </div>
  );
}

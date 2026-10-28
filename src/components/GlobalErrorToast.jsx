import React from 'react';
import { AlertCircle, X } from 'lucide-react';

export function GlobalErrorToast({ notification, onDismiss }) {
  if (!notification) return null;
  return (
    <div className="toast" role="alert" aria-live="assertive">
      <AlertCircle size={18} />
      <span>{notification.message}</span>
      <button type="button" aria-label="Dismiss" onClick={onDismiss}><X size={16} /></button>
    </div>
  );
}

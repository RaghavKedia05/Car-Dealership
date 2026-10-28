import React, { useState } from 'react';
import { Check, LockKeyhole } from 'lucide-react';

export function PasswordReset({ api, navigate, token }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(token ? '' : 'This reset link is missing its token. Request a new one.');
  const [notice, setNotice] = useState('');
  async function submit(event) {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('The passwords do not match.'); return; }
    setBusy(true);
    try {
      const result = await api('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
      setNotice(result.message);
      setPassword('');
      setConfirmPassword('');
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  return (
    <section className="account-recovery-card">
      <p className="eyebrow"><span className="eyebrow-line" /> ACCOUNT RECOVERY</p><h1>Choose a new <span>password.</span></h1>
      <p>Use at least 12 characters. This link can only be used once.</p>
      {error && <div className="form-error" role="alert">{error}</div>}{notice && <div className="form-success" role="status"><Check size={15} /> {notice}</div>}
      {!notice && <form onSubmit={submit}><label className="form-label">NEW PASSWORD<input required type="password" minLength="12" maxLength="72" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="form-label">CONFIRM PASSWORD<input required type="password" minLength="12" maxLength="72" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label><button className="auth-submit" type="submit" disabled={busy || !token}>{busy ? 'Updating…' : 'Update password'} <LockKeyhole size={16} /></button></form>}
      <button className="account-recovery-back" type="button" onClick={() => navigate('/login')}>Back to sign in</button>
    </section>
  );
}

import React, { useState } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';

export function PasswordRecovery({ api, navigate, email: initialEmail = '' }) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
      setNotice(result.message);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  return (
    <section className="account-recovery-card">
      <p className="eyebrow"><span className="eyebrow-line" /> ACCOUNT RECOVERY</p><h1>Reset your <span>password.</span></h1>
      <p>Enter the email address on your account. If it matches an account and recovery email is configured, we’ll send a link that expires in 30 minutes.</p>
      {error && <div className="form-error" role="alert">{error}</div>}{notice && <div className="form-success" role="status"><Check size={15} /> {notice}</div>}
      <form onSubmit={submit}><label className="form-label">EMAIL ADDRESS<input required type="email" maxLength="254" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'} <ArrowUpRight size={16} /></button></form>
      <button className="account-recovery-back" type="button" onClick={() => navigate('/login')}>Back to sign in</button>
    </section>
  );
}

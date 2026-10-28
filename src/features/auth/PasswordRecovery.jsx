import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleAlert } from 'lucide-react';

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
      setNotice(result.message || 'If an account exists for that email, a reset link is on its way.');
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  return (
    <section className="container page">
      <div className="card narrow-card">
        <button className="breadcrumb" type="button" onClick={() => navigate('/login')}><ArrowLeft size={16} /> Back to sign in</button>
        <h1>Forgot your password?</h1>
        <p>Enter your account email and we’ll send you a link to reset it. The link expires in 30 minutes.</p>
        {error && <div className="alert alert-error" role="alert"><CircleAlert size={16} /><span>{error}</span></div>}
        {notice && <div className="alert alert-success" role="status"><Check size={16} /><span>{notice}</span></div>}
        <form className="form-stack" onSubmit={submit}>
          <label className="field">Email<input required type="email" maxLength="254" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'} <ArrowRight size={16} /></button>
        </form>
      </div>
    </section>
  );
}

import React, { useState } from 'react';
import { ArrowLeft, Check, CircleAlert, LockKeyhole } from 'lucide-react';

export function PasswordReset({ api, navigate, token }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(token ? '' : 'This reset link is invalid or incomplete. Please request a new one.');
  const [notice, setNotice] = useState('');
  async function submit(event) {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('The passwords don’t match.'); return; }
    setBusy(true);
    try {
      const result = await api('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
      setNotice(result.message || 'Your password has been updated. You can now sign in.');
      setPassword('');
      setConfirmPassword('');
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  return (
    <section className="container page">
      <div className="card narrow-card">
        <button className="breadcrumb" type="button" onClick={() => navigate('/login')}><ArrowLeft size={16} /> Back to sign in</button>
        <h1>Set a new password</h1>
        <p>Use at least 12 characters. This link can only be used once.</p>
        {error && <div className="alert alert-error" role="alert"><CircleAlert size={16} /><span>{error}</span></div>}
        {notice && <div className="alert alert-success" role="status"><Check size={16} /><span>{notice}</span></div>}
        {notice ? (
          <button className="btn btn-dark btn-lg btn-block" type="button" onClick={() => navigate('/login')}>Go to sign in</button>
        ) : (
          <form className="form-stack" onSubmit={submit}>
            <label className="field">New password<input required type="password" minLength="12" maxLength="72" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <label className="field">Confirm password<input required type="password" minLength="12" maxLength="72" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy || !token}>{busy ? 'Updating…' : 'Update password'} <LockKeyhole size={16} /></button>
          </form>
        )}
      </div>
    </section>
  );
}

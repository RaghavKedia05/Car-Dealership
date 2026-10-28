import React, { useState } from 'react';
import { ArrowUpRight, Check, CircleHelp, LockKeyhole } from 'lucide-react';
import { apiUrl, reportError, parseApiResponse } from '../../lib/api-client.js';

export function AuthForm({ mode, setMode, navigate, onAuthenticated, setError, error, notice, setNotice }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationPending, setVerificationPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const registering = mode === 'register';

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const verifying = registering && verificationPending;
      const endpoint = verifying ? '/api/auth/register/verify' : `/api/auth/${registering ? 'register' : 'login'}`;
      const payload = verifying
        ? { email, code: otp }
        : { ...(registering ? { name } : {}), email, password };
      const response = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await parseApiResponse(response, 'We could not sign you in. Please try again.');
      if (registering && !verifying) {
        setVerificationPending(true);
        setOtp('');
        setNotice(body.message || 'A verification code was sent to your email.');
        return;
      }
      if (verifying) {
        onAuthenticated({ token: body.token, user: body.user });
        return;
      }
      onAuthenticated({ token: body.token, user: body.user });
    } catch (requestError) {
      reportError(requestError);
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function resendCode() {
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const body = await parseApiResponse(response, 'We could not send a new verification code. Please try again.');
      setNotice(body.message || 'A new verification code was sent.');
    } catch (requestError) {
      reportError(requestError);
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form stitch-auth-card" onSubmit={submit}>
      <h3>{registering ? verificationPending ? 'Verify your email.' : 'Create your account.' : 'Welcome back.'}</h3>
      <p>{registering
        ? verificationPending
          ? `Enter the six-digit code sent to ${email}. It expires in 10 minutes.`
          : 'Save your details and manage your vehicle orders.'
        : 'Enter your email and password to continue.'}</p>
      {notice && <div className="form-success" role="status"><Check size={15} /> {notice}</div>}
      {error && <div className="form-error" role="alert"><CircleHelp size={16} /> {error}</div>}
      {registering && !verificationPending && <label className="form-label">YOUR NAME<input required minLength="2" maxLength="80" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex Morgan" /></label>}
      {(!registering || !verificationPending) && <label className="form-label">EMAIL ADDRESS<input required type="email" maxLength="254" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>}
      {registering && verificationPending && <label className="form-label">EMAIL VERIFICATION CODE<input required type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength="6" maxLength="6" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" /></label>}
      {(!registering || !verificationPending) && <label className="form-label">PASSWORD<input required type="password" minLength={registering ? 12 : 1} maxLength="72" autoComplete={registering ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={registering ? 'At least 12 characters' : 'Your password'} /></label>}
      {!registering && <button className="auth-forgot-link" type="button" onClick={() => navigate('/forgot-password')}>Forgot password?</button>}
      {registering && verificationPending && <button className="auth-forgot-link" type="button" disabled={submitting} onClick={resendCode}>Resend verification code</button>}
      <button className="auth-submit" disabled={submitting} type="submit">
        {submitting ? 'One moment…' : registering ? verificationPending ? 'Verify email & create account' : 'Continue with email verification' : 'Sign in'}
        <ArrowUpRight size={16} />
      </button>
      <div className="auth-switch">
        <span>{registering ? verificationPending ? 'Want to use another email?' : 'Already have an account?' : 'New around here?'}</span>
        <button type="button" onClick={() => {
          if (registering && verificationPending) setVerificationPending(false);
          else setMode(registering ? 'login' : 'register');
          setOtp(''); setError(''); setNotice('');
        }}>
          {registering ? verificationPending ? 'Change details' : 'Sign in' : 'Create an account'}
        </button>
      </div>
      <span className="form-secure"><LockKeyhole size={13} /> YOUR DETAILS STAY YOURS</span>
    </form>
  );
}

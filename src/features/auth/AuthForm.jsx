import React, { useState } from 'react';
import { ArrowRight, Check, CircleAlert } from 'lucide-react';
import { apiUrl, reportError, parseApiResponse } from '../../lib/api-client.js';

export function AuthForm({ mode, setMode, navigate, onAuthenticated, setError, error, notice, setNotice }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const registering = mode === 'register';

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(apiUrl(`/api/auth/${registering ? 'register' : 'login'}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(registering ? { name } : {}), email, password }),
      });
      const body = await parseApiResponse(
        response,
        registering ? 'We couldn’t create your account. Please try again.' : 'We couldn’t sign you in. Please try again.',
      );
      onAuthenticated({ token: body.token, user: body.user });
    } catch (requestError) {
      if (requestError instanceof TypeError) reportError(requestError);
      setError(requestError instanceof TypeError ? 'We can’t connect right now. Please try again.' : requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode() {
    setMode(registering ? 'login' : 'register');
    setError('');
    setNotice('');
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <h2>{registering ? 'Create your account' : 'Welcome back'}</h2>
      <p>{registering
        ? 'It only takes a minute. You’ll be able to browse, compare, and reserve cars.'
        : 'Sign in to browse the showroom and manage your reservations.'}</p>
      {notice && <div className="alert alert-success" role="status"><Check size={16} /><span>{notice}</span></div>}
      {error && <div className="alert alert-error" role="alert"><CircleAlert size={16} /><span>{error}</span></div>}
      <div className="form-stack">
        {registering && (
          <label className="field">Full name<input required minLength="2" maxLength="80" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>
        )}
        <label className="field">Email<input required type="email" maxLength="254" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label className="field">Password
          <input required type="password" minLength={registering ? 12 : 1} maxLength="72" autoComplete={registering ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={registering ? 'At least 12 characters' : 'Your password'} />
        </label>
        {!registering && <div className="auth-row"><button className="link-btn" type="button" onClick={() => navigate('/forgot-password')}>Forgot password?</button></div>}
        <button className="btn btn-primary btn-lg btn-block" disabled={submitting} type="submit">
          {submitting && <span className="spinner spinner-sm" />}
          {submitting ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}
          {!submitting && <ArrowRight size={16} />}
        </button>
      </div>
      <p className="auth-switch">
        {registering ? 'Already have an account? ' : 'New to Apex Auto? '}
        <button className="link-btn" type="button" onClick={switchMode}>{registering ? 'Sign in' : 'Create an account'}</button>
      </p>
    </form>
  );
}

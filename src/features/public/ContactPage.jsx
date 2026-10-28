import React, { useEffect, useState } from 'react';
import { ArrowRight, CarFront, Check, CircleAlert, Clock, MessageSquare } from 'lucide-react';

export function ContactPage({ api, vehicleId: initialVehicleId, session }) {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState(initialVehicleId || '');
  const [form, setForm] = useState({ customerName: session?.user.name || '', email: session?.user.email || '', phone: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    api('/api/public/vehicles?pageSize=100')
      .then((result) => { if (active) setVehicles(result.vehicles); })
      .catch(() => { /* The form still works as a general enquiry. */ });
    return () => { active = false; };
  }, [api]);

  useEffect(() => {
    setVehicleId(initialVehicleId || '');
  }, [initialVehicleId]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setSuccess('');
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const submissionKey = window.crypto.randomUUID();
      const result = await api('/api/enquiries', {
        method: 'POST',
        body: JSON.stringify({ ...form, subject: form.subject.trim() || 'Vehicle enquiry', vehicleId: vehicleId || undefined, submissionKey }),
      });
      setSuccess(result.message || 'Thanks! Your message has been sent. Our team will be in touch soon.');
      setForm((current) => ({ ...current, phone: '', subject: '', message: '' }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="container page contact">
      <div>
        <p className="eyebrow">Contact us</p>
        <h1 className="page-title" style={{ marginTop: 10 }}>Let’s talk about your next car</h1>
        <p className="page-lede">Have a question about a car, financing, or availability? Send us a message and our team will get back to you.</p>
        <div className="contact-points">
          <div className="card contact-point"><CarFront /><div><strong>Ask about a specific car</strong><span>Choose it from the list and we’ll reply with everything you need to know.</span></div></div>
          <div className="card contact-point"><MessageSquare /><div><strong>Not sure what to buy?</strong><span>Tell us your budget and needs — we’ll suggest a few great options.</span></div></div>
          <div className="card contact-point"><Clock /><div><strong>Quick, personal replies</strong><span>A real person from our team reads every message.</span></div></div>
        </div>
      </div>
      <form className="card contact-form" onSubmit={submit}>
        {error && <div className="alert alert-error" role="alert"><CircleAlert size={16} /><span>{error}</span></div>}
        {success && <div className="alert alert-success" role="status"><Check size={16} /><span>{success}</span></div>}
        <div className="form-grid">
          <label className="field">Full name<input required minLength="2" maxLength="80" autoComplete="name" value={form.customerName} onChange={(event) => update('customerName', event.target.value)} placeholder="Your name" /></label>
          <label className="field">Email<input required type="email" maxLength="254" autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="you@example.com" /></label>
          <label className="field">Phone (optional)<input type="tel" maxLength="30" autoComplete="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+91" /></label>
          <label className="field">Car you’re interested in<select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}><option value="">General enquiry</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model}</option>)}</select></label>
          <label className="field span-2">Subject<input maxLength="120" value={form.subject} onChange={(event) => update('subject', event.target.value)} placeholder="What can we help with?" /></label>
          <label className="field span-2">Message<textarea required minLength="10" maxLength="4000" rows="6" value={form.message} onChange={(event) => update('message', event.target.value)} placeholder="Tell us a bit about what you’re looking for…" /></label>
        </div>
        <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Send message'} <ArrowRight size={16} /></button>
      </form>
    </section>
  );
}

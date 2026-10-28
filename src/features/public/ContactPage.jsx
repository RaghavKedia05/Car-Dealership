import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Check, CircleHelp, LockKeyhole } from 'lucide-react';

export function ContactPage({ api, vehicleId: initialVehicleId, session }) {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState(initialVehicleId || '');
  const [vehicleLoadError, setVehicleLoadError] = useState('');
  const [form, setForm] = useState({ customerName: session?.user.name || '', email: session?.user.email || '', phone: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    api('/api/public/vehicles?pageSize=100')
      .then((result) => { if (active) setVehicles(result.vehicles); })
      .catch((requestError) => { if (active) setVehicleLoadError(requestError.message); });
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
      setSuccess(result.message);
      setForm((current) => ({ ...current, phone: '', subject: '', message: '' }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="public-contact-page">
      <div className="public-contact-intro">
        <p className="eyebrow"><span className="eyebrow-line" /> START A CONVERSATION</p>
        <h1>Let’s talk about <span>your next drive.</span></h1>
        <p>Send a question about a listing or tell us what you’re looking for. The dealership will receive your message as an enquiry.</p>
        <div className="contact-detail-note"><LockKeyhole size={17} /><span>Your details are used to respond to this enquiry. No dealership phone number or address has been configured in this catalogue.</span></div>
      </div>
      <form className="public-contact-form" onSubmit={submit}>
        {error && <div className="form-error" role="alert"><CircleHelp size={16} /> {error}</div>}
        {success && <div className="form-success" role="status"><Check size={16} /> {success}</div>}
        {vehicleLoadError && <p className="field-help" role="status">Vehicle choices could not be loaded: {vehicleLoadError} You can still send a general enquiry.</p>}
        <div className="editor-grid">
          <label className="form-label">YOUR NAME<input required minLength="2" maxLength="80" autoComplete="name" value={form.customerName} onChange={(event) => update('customerName', event.target.value)} /></label>
          <label className="form-label">EMAIL ADDRESS<input required type="email" maxLength="254" autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></label>
          <label className="form-label">PHONE (OPTIONAL)<input type="tel" maxLength="30" autoComplete="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} /></label>
          <label className="form-label">VEHICLE (OPTIONAL)<select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}><option value="">General enquiry</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model}</option>)}</select></label>
          <label className="form-label form-label-full">SUBJECT<input maxLength="120" value={form.subject} onChange={(event) => update('subject', event.target.value)} placeholder="What can we help with?" /></label>
          <label className="form-label form-label-full">MESSAGE<textarea required minLength="10" maxLength="4000" rows="6" value={form.message} onChange={(event) => update('message', event.target.value)} placeholder="Share your question or the kind of vehicle you’re looking for." /></label>
        </div>
        <button className="public-button" type="submit" disabled={submitting}>{submitting ? 'Sending enquiry…' : 'Send enquiry'} <ArrowUpRight size={16} /></button>
      </form>
    </section>
  );
}

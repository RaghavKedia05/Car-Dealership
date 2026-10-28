import React, { useRef, useState } from 'react';
import { ArrowRight, CarFront, Check, CircleAlert, X } from 'lucide-react';
import { money } from '../../lib/currency-format.js';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility.js';

export function VehicleCheckout({ vehicle, user, api, navigate, onComplete }) {
  const [customerName, setCustomerName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [deliveryAddress, setDeliveryAddress] = useState(user.deliveryAddress || '');
  const [paymentMethod, setPaymentMethod] = useState('dealership');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const dialogRef = useRef(null);
  useDialogAccessibility(dialogRef, () => onComplete(null), confirmation ? 'confirmation' : 'order-form');

  async function placeOrder(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api(`/api/vehicles/${vehicle.id}/checkout`, {
        method: 'POST',
        body: JSON.stringify({ customerName, email, phone, deliveryAddress, paymentMethod }),
      });
      setConfirmation(result);
      onComplete(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  if (confirmation) {
    const paymentLabel = confirmation.order.paymentMethod === 'callback' ? 'We’ll call you' : 'Pay at dealership';
    return (
      <div className="modal-backdrop">
        <section className="modal confirm-center" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="checkout-title" tabIndex="-1">
          <button className="icon-btn" style={{ position: 'absolute', top: 20, right: 20 }} type="button" aria-label="Close" onClick={() => onComplete(null)}><X size={18} /></button>
          <div className="success-mark"><Check size={26} /></div>
          <h2 id="checkout-title">Your car is reserved!</h2>
          <p>We’re holding the <strong>{confirmation.vehicle.make} {confirmation.vehicle.model}</strong> for you for 24 hours. Our team will contact you shortly to confirm the next steps.</p>
          <div className="kv-grid">
            <div><span>Reference</span><strong>#{confirmation.order.id.slice(0, 8).toUpperCase()}</strong></div>
            <div><span>Total</span><strong>{money(confirmation.order.totalAmount)}</strong></div>
            <div><span>Payment</span><strong>{paymentLabel}</strong></div>
            <div><span>Status</span><strong>Awaiting confirmation</strong></div>
          </div>
          <div className="modal-foot" style={{ justifyContent: 'center' }}>
            <button className="btn btn-secondary" type="button" onClick={() => onComplete(null)}>Keep browsing</button>
            <button className="btn btn-primary" type="button" onClick={() => { onComplete(null); navigate('/account'); }}>View my orders <ArrowRight size={16} /></button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onComplete(null); }}>
      <form className="modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="checkout-title" onSubmit={placeOrder}>
        <div className="modal-head">
          <div><h2 id="checkout-title">Reserve your car</h2><p>No payment is taken online.</p></div>
          <button className="icon-btn" type="button" aria-label="Close" onClick={() => onComplete(null)}><X size={18} /></button>
        </div>
        <div className="summary-row">
          <div className="thumb">{vehicle.imageUrl ? <img src={vehicle.imageUrl} alt="" /> : <CarFront size={26} />}</div>
          <div><strong>{vehicle.make} {vehicle.model}</strong><small>{[vehicle.year || vehicle.specifications?.year, vehicle.variant, vehicle.category].filter(Boolean).join(' · ')}</small></div>
          <strong className="price" style={{ fontSize: 18 }}>{money(vehicle.price)}</strong>
        </div>
        <p className="step-label"><span>1</span> Your details</p>
        <div className="form-grid">
          <label className="field">Full name<input required minLength="2" maxLength="80" autoComplete="name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
          <label className="field">Phone<input required type="tel" minLength="7" maxLength="20" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" /></label>
          <label className="field span-2">Email<input required type="email" maxLength="254" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="field span-2">Delivery address<textarea required minLength="8" maxLength="500" autoComplete="street-address" rows="2" value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="House / flat, street, city, PIN code" /></label>
        </div>
        <p className="step-label"><span>2</span> How would you like to pay?</p>
        <div className="radio-cards">
          <label className={`radio-card ${paymentMethod === 'dealership' ? 'selected' : ''}`}>
            <input type="radio" name="paymentMethod" value="dealership" checked={paymentMethod === 'dealership'} onChange={() => setPaymentMethod('dealership')} />
            <span><strong>Pay at the dealership</strong><small>Visit us to complete payment and paperwork.</small></span>
          </label>
          <label className={`radio-card ${paymentMethod === 'callback' ? 'selected' : ''}`}>
            <input type="radio" name="paymentMethod" value="callback" checked={paymentMethod === 'callback'} onChange={() => setPaymentMethod('callback')} />
            <span><strong>Request a call back</strong><small>We’ll call to discuss payment, finance, and delivery.</small></span>
          </label>
        </div>
        {error && <div className="alert alert-error" role="alert" style={{ marginTop: 16 }}><CircleAlert size={16} /><span>{error}</span></div>}
        <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 22 }} type="submit" disabled={loading}>
          {loading ? <><span className="spinner spinner-sm" /> Reserving…</> : <>Reserve now <ArrowRight size={16} /></>}
        </button>
        <p className="fine-print">Your car is held for 24 hours while our team confirms availability with you.</p>
      </form>
    </div>
  );
}

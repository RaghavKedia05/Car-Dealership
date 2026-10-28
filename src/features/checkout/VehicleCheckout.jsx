import React, { useRef, useState } from 'react';
import { ArrowUpRight, Check, CircleHelp, X } from 'lucide-react';
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
    const paymentLabel = confirmation.order.paymentMethod === 'callback' ? 'Dealership callback requested' : 'Arrange payment at dealership';
    return (
      <div className="checkout-backdrop">
        <section className="checkout-dialog checkout-confirmation" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="checkout-title" tabIndex="-1">
          <div className="checkout-heading">
            <div><p className="eyebrow"><span className="eyebrow-line" /> ORDER REQUEST RECEIVED</p><h2 id="checkout-title">Next steps, <span>in motion.</span></h2></div>
            <button className="icon-button" type="button" aria-label="Close confirmation" onClick={() => onComplete(null)}><X size={18} /></button>
          </div>
          <div className="checkout-confirmation-mark"><Check size={23} /></div>
          <p className="checkout-confirmation-title">{confirmation.vehicle.make} {confirmation.vehicle.model}</p>
          <p className="checkout-confirmation-copy">Your order is reserved for up to 24 hours. No online payment was taken. Our dealership team will confirm availability and help complete payment.</p>
          <div className="checkout-confirmation-details">
            <div><span>ORDER REFERENCE</span><strong>{confirmation.order.id.slice(0, 8).toUpperCase()}</strong></div>
            <div><span>ORDER TOTAL</span><strong>{money(confirmation.order.totalAmount)}</strong></div>
            <div><span>PAYMENT PREFERENCE</span><strong>{paymentLabel}</strong></div>
            <div><span>STATUS</span><strong>Awaiting dealership confirmation</strong></div>
          </div>
          <div className="checkout-confirmation-actions">
            <button className="checkout-pay-button" type="button" onClick={() => { onComplete(null); navigate('/account'); }}>View my orders <ArrowUpRight size={16} /></button>
            <button className="checkout-secondary-button" type="button" onClick={() => onComplete(null)}>Return to showroom</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="checkout-backdrop">
      <form className="checkout-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="checkout-title" onSubmit={placeOrder}>
        <div className="checkout-heading">
          <div><p className="eyebrow"><span className="eyebrow-line" /> VEHICLE ORDER</p><h2 id="checkout-title">Your details <span>and payment plan.</span></h2></div>
          <button className="icon-button" type="button" aria-label="Close order form" onClick={() => onComplete(null)}> <X size={18} /></button>
        </div>
        <div className="checkout-vehicle-summary">
          <div><span>VEHICLE</span><strong>{vehicle.make} {vehicle.model}</strong></div>
          <div><span>ORDER TOTAL</span><strong>{money(vehicle.price)}</strong></div>
        </div>
        <p className="checkout-step-label">01 <span>Buyer and delivery details</span></p>
        <div className="checkout-fields">
          <label className="form-label">FULL NAME<input required minLength="2" maxLength="80" autoComplete="name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
          <label className="form-label">EMAIL ADDRESS<input required type="email" maxLength="254" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="form-label">PHONE NUMBER<input required type="tel" minLength="7" maxLength="20" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Include country code" /></label>
          <label className="form-label checkout-address">DELIVERY ADDRESS<textarea required minLength="8" maxLength="500" autoComplete="street-address" rows="3" value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} /></label>
        </div>
        <p className="checkout-step-label">02 <span>Choose how you would like to arrange payment</span></p>
        <div className="checkout-payment-options">
          <label className={paymentMethod === 'dealership' ? 'selected' : ''}>
            <input type="radio" name="paymentMethod" value="dealership" checked={paymentMethod === 'dealership'} onChange={() => setPaymentMethod('dealership')} />
            <span><strong>Pay at the dealership</strong><small>Our team will confirm the vehicle and arrange payment in person.</small></span>
          </label>
          <label className={paymentMethod === 'callback' ? 'selected' : ''}>
            <input type="radio" name="paymentMethod" value="callback" checked={paymentMethod === 'callback'} onChange={() => setPaymentMethod('callback')} />
            <span><strong>Request a payment callback</strong><small>We will contact you to discuss payment and delivery arrangements.</small></span>
          </label>
        </div>
        {error && <div className="form-error" role="alert"><CircleHelp size={16} /> {error}</div>}
        <button className="checkout-pay-button" type="submit" disabled={loading}>
          {loading ? 'Placing order…' : `Place order request · ${money(vehicle.price)}`}
          <ArrowUpRight size={16} />
        </button>
        <p className="checkout-disclaimer">This submits an order request, not an online charge. Your reservation is held for up to 24 hours while the dealership confirms next steps.</p>
      </form>
    </div>
  );
}

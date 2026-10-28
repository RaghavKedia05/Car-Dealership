import React, { useEffect, useState } from 'react';
import { ArrowUpRight, CarFront, Check, LockKeyhole } from 'lucide-react';
import { money } from '../../lib/currency-format.js';

export function CustomerDashboard({ api, user, onUserUpdated, onPasswordChanged, navigate }) {
  const [tab, setTab] = useState('overview');
  const [profile, setProfile] = useState(user);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([api('/api/account'), api('/api/account/orders')])
      .then(([account, history]) => {
        if (!active) return;
        setProfile(account.user);
        setOrders(history.orders);
        onUserUpdated(account.user);
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api]);

  async function saveProfile(event) {
    event.preventDefault();
    setSavingProfile(true);
    setError('');
    setNotice('');
    try {
      const result = await api('/api/account', {
        method: 'PUT',
        body: JSON.stringify({ name: profile.name, phone: profile.phone || '', deliveryAddress: profile.deliveryAddress || '' }),
      });
      setProfile(result.user);
      onUserUpdated(result.user);
      setNotice('Your contact details have been saved.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      const result = await api('/api/account/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      onPasswordChanged(result);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNotice('Password changed. Other signed-in sessions were signed out.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingPassword(false);
    }
  }

  const completedOrders = orders.filter((order) => order.status === 'paid');
  const openOrders = orders.filter((order) => ['pending', 'refunding', 'refunded'].includes(order.status));

  return (
    <section className="customer-dashboard" aria-labelledby="customer-dashboard-title">
      <div className="customer-dashboard-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-line" /> YOUR APEX AUTO ACCOUNT</p>
          <h1 id="customer-dashboard-title">Welcome back, <span>{profile.name?.split(' ')[0] || 'driver'}.</span></h1>
          <p>Keep your vehicle orders and contact details together in one place.</p>
        </div>
        <button className="public-button" type="button" onClick={() => navigate('/showroom')}>Browse the showroom <ArrowUpRight size={15} /></button>
      </div>

      <nav className="customer-account-tabs" aria-label="Account sections">
        {[
          ['overview', 'Overview'], ['orders', 'My orders'], ['profile', 'Contact details'], ['security', 'Security'],
        ].map(([value, label]) => (
          <button key={value} type="button" className={tab === value ? 'active' : ''} aria-current={tab === value ? 'page' : undefined} onClick={() => { setTab(value); setError(''); setNotice(''); }}>{label}</button>
        ))}
      </nav>

      {error && <div className="customer-account-alert" role="alert">{error}</div>}
      {notice && <div className="customer-account-success" role="status"><Check size={16} /> {notice}</div>}
      {loading ? <div className="customer-account-loading"><span className="loading-spinner" /> Loading your account…</div> : (
        <>
          {tab === 'overview' && (
            <div className="customer-account-overview">
              <div className="customer-account-metrics">
                <article><span>COMPLETED PURCHASES</span><strong>{completedOrders.length}</strong><small>Verified and recorded</small></article>
                <article><span>ORDERS AWAITING PAYMENT</span><strong>{openOrders.filter((order) => order.status === 'pending').length}</strong><small>The dealership will confirm payment arrangements</small></article>
                <article><span>CONTACT DETAILS</span><strong>{profile.phone ? 'Ready' : 'Add phone'}</strong><small>{profile.deliveryAddress ? 'Delivery address saved' : 'Save an address for checkout'}</small></article>
              </div>
              <div className="customer-account-panels">
                <section className="customer-account-panel">
                  <div className="customer-account-panel-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Your latest <span>orders.</span></h2></div><button type="button" onClick={() => setTab('orders')}>View all <ArrowUpRight size={14} /></button></div>
                  {orders.length ? orders.slice(0, 3).map((order) => <CustomerOrderRow key={order.id} order={order} compact />) : <p className="customer-account-empty">No vehicle orders yet. Your confirmed purchases will appear here.</p>}
                </section>
                <section className="customer-account-panel customer-account-contact-card">
                  <p className="eyebrow">YOUR CONTACT CARD</p><h2>{profile.name}</h2><p>{profile.email}</p><p>{profile.phone || 'Phone number not added'}</p><p>{profile.deliveryAddress || 'Delivery address not added'}</p><button type="button" onClick={() => setTab('profile')}>Update details <ArrowUpRight size={14} /></button>
                </section>
              </div>
            </div>
          )}

          {tab === 'orders' && (
            <section className="customer-account-panel customer-orders-panel">
              <div className="customer-account-panel-heading"><div><p className="eyebrow">ORDER HISTORY</p><h2>Vehicles you’ve <span>reserved.</span></h2></div><span>{orders.length} {orders.length === 1 ? 'order' : 'orders'}</span></div>
              {orders.length ? orders.map((order) => <CustomerOrderRow key={order.id} order={order} />) : <p className="customer-account-empty">There are no orders on this account yet. When you purchase a vehicle, its payment and delivery details will appear here.</p>}
            </section>
          )}

          {tab === 'profile' && (
            <form className="customer-account-panel customer-profile-form" onSubmit={saveProfile}>
              <div className="customer-account-panel-heading"><div><p className="eyebrow">BUYER INFORMATION</p><h2>Contact <span>details.</span></h2></div></div>
              <p className="customer-account-help">These details make vehicle enquiries and checkout faster. Your email is your sign-in address.</p>
              <div className="customer-profile-grid">
                <label>Full name<input required minLength="2" maxLength="80" autoComplete="name" value={profile.name || ''} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} /></label>
                <label>Email address<input value={profile.email || ''} readOnly disabled /></label>
                <label>Phone number<input type="tel" maxLength="20" autoComplete="tel" placeholder="Include country code" value={profile.phone || ''} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} /></label>
                <label className="customer-profile-address">Delivery address<textarea rows="4" maxLength="500" autoComplete="street-address" placeholder="Flat or house, street, city, state and PIN code" value={profile.deliveryAddress || ''} onChange={(event) => setProfile((current) => ({ ...current, deliveryAddress: event.target.value }))} /></label>
              </div>
              <button className="public-button" type="submit" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save contact details'} <Check size={15} /></button>
            </form>
          )}

          {tab === 'security' && (
            <div className="customer-account-panel customer-security-panel">
              <p className="eyebrow">ACCOUNT SECURITY</p><h2>Keep your account <span>safe.</span></h2>
              <p className="customer-account-help">Change your password here. If you can’t sign in, request a time-limited reset link by email.</p>
              <form className="customer-password-form" onSubmit={changePassword}>
                <label>Current password<input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
                <label>New password<input required type="password" minLength="12" maxLength="72" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 12 characters" /></label>
                <label>Confirm new password<input required type="password" minLength="12" maxLength="72" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
                <button className="public-button" type="submit" disabled={savingPassword}>{savingPassword ? 'Updating…' : 'Change password'} <LockKeyhole size={15} /></button>
              </form>
              <div className="customer-recovery-link"><span>Forgot your current password?</span><button type="button" onClick={() => navigate(`/forgot-password?email=${encodeURIComponent(profile.email || '')}`)}>Email me a reset link</button></div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function CustomerOrderRow({ order, compact = false }) {
  const statusLabels = { paid: 'Payment confirmed', pending: 'Order placed · payment pending', cancelled: 'Order cancelled', refunding: 'Refund processing', refunded: 'Refunded', expired: 'Reservation expired' };
  const paymentLabels = { dealership: 'Pay at the dealership', callback: 'Payment callback requested', legacy_online: 'Online payment (legacy order)' };
  return (
    <article className={`customer-order-row ${compact ? 'compact' : ''}`}>
      <div className="customer-order-vehicle">
        {order.vehicle.imageUrl ? <img src={order.vehicle.imageUrl} alt="" loading="lazy" /> : <span className="customer-order-placeholder"><CarFront size={22} /></span>}
        <div><strong>{order.vehicle.year ? `${order.vehicle.year} ` : ''}{order.vehicle.make} {order.vehicle.model}</strong><small>Order {order.id.slice(0, 8).toUpperCase()} · {new Date(order.createdAt).toLocaleDateString()}</small></div>
      </div>
      <div className="customer-order-details">
        <span className={`customer-order-status status-${order.status}`}>{statusLabels[order.status] || order.status}</span>
        <strong>{money(order.totalAmount)}</strong>
        {!compact && <><small>{order.phone} · {order.email}</small><small>{order.deliveryAddress}</small>{order.paymentMethod && <small>Payment: {paymentLabels[order.paymentMethod] || order.paymentMethod}</small>}{order.paymentId && <small>Payment reference: {order.paymentId}</small>}</>}
      </div>
    </article>
  );
}

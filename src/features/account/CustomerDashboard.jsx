import React, { useEffect, useState } from 'react';
import { ArrowRight, CarFront, Check, CircleAlert, LockKeyhole } from 'lucide-react';
import { money } from '../../lib/currency-format.js';

const TABS = [['overview', 'Overview'], ['orders', 'My orders'], ['profile', 'Profile'], ['security', 'Password']];

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
      setNotice('Your profile has been saved.');
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
      setError('The new passwords don’t match.');
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
      setNotice('Password updated. You’ve been signed out on other devices.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingPassword(false);
    }
  }

  const completedOrders = orders.filter((order) => order.status === 'paid');
  const pendingOrders = orders.filter((order) => order.status === 'pending');
  const profileComplete = Boolean(profile.phone && profile.deliveryAddress);

  return (
    <section className="container page" aria-labelledby="customer-dashboard-title">
      <div className="page-head">
        <div>
          <p className="eyebrow">My account</p>
          <h1 className="page-title" id="customer-dashboard-title">Welcome back, {profile.name?.split(' ')[0] || 'there'}</h1>
          <p className="page-lede">Track your reservations and keep your details up to date.</p>
        </div>
        <button className="btn btn-dark" type="button" onClick={() => navigate('/showroom')}>Browse cars <ArrowRight size={16} /></button>
      </div>

      <nav className="tabs" aria-label="Account sections">
        {TABS.map(([value, label]) => (
          <button key={value} type="button" className={tab === value ? 'active' : ''} aria-current={tab === value ? 'page' : undefined} onClick={() => { setTab(value); setError(''); setNotice(''); }}>{label}</button>
        ))}
      </nav>

      {error && <div className="alert alert-error" role="alert" style={{ marginBottom: 16 }}><CircleAlert size={16} /><span>{error}</span></div>}
      {notice && <div className="alert alert-success" role="status" style={{ marginBottom: 16 }}><Check size={16} /><span>{notice}</span></div>}

      {loading ? <div className="loading-block"><span className="spinner" /> Loading your account…</div> : (
        <>
          {tab === 'overview' && (
            <>
              <div className="stat-grid">
                <article className="card stat"><span>Reservations in progress</span><strong>{pendingOrders.length}</strong><small>Our team will confirm with you</small></article>
                <article className="card stat"><span>Completed purchases</span><strong>{completedOrders.length}</strong><small>Payment confirmed</small></article>
                <article className="card stat"><span>Profile</span><strong>{profileComplete ? 'Complete' : 'Incomplete'}</strong><small>{profileComplete ? 'Ready for quick checkout' : 'Add phone & address for faster checkout'}</small></article>
              </div>
              <div className="two-col">
                <section className="card panel">
                  <div className="panel-head"><div><h2>Recent orders</h2></div>{orders.length > 0 && <button className="link-btn" type="button" onClick={() => setTab('orders')}>View all</button>}</div>
                  {orders.length ? orders.slice(0, 3).map((order) => <CustomerOrderRow key={order.id} order={order} compact />) : (
                    <div className="empty" style={{ padding: '24px 0' }}>
                      <div className="empty-icon"><CarFront size={24} /></div>
                      <p>You haven’t reserved a car yet.</p>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => navigate('/showroom')}>Find a car</button>
                    </div>
                  )}
                </section>
                <section className="card panel profile-card">
                  <div className="panel-head"><h2>Your details</h2><button className="link-btn" type="button" onClick={() => setTab('profile')}>Edit</button></div>
                  <dl>
                    <div><dt>Name</dt><dd>{profile.name}</dd></div>
                    <div><dt>Email</dt><dd>{profile.email}</dd></div>
                    <div><dt>Phone</dt><dd className={profile.phone ? '' : 'missing'}>{profile.phone || 'Not added'}</dd></div>
                    <div><dt>Delivery address</dt><dd className={profile.deliveryAddress ? '' : 'missing'}>{profile.deliveryAddress || 'Not added'}</dd></div>
                  </dl>
                </section>
              </div>
            </>
          )}

          {tab === 'orders' && (
            <section className="card panel">
              <div className="panel-head"><div><h2>Order history</h2><p>{orders.length} {orders.length === 1 ? 'order' : 'orders'}</p></div></div>
              {orders.length ? orders.map((order) => <CustomerOrderRow key={order.id} order={order} />) : <p className="panel-empty">No orders yet. When you reserve a car, it will appear here.</p>}
            </section>
          )}

          {tab === 'profile' && (
            <form className="card panel form-panel" onSubmit={saveProfile}>
              <div className="panel-head"><div><h2>Profile</h2><p>Saved details are used to pre-fill your reservations.</p></div></div>
              <div className="form-grid">
                <label className="field">Full name<input required minLength="2" maxLength="80" autoComplete="name" value={profile.name || ''} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} /></label>
                <label className="field">Email<input value={profile.email || ''} readOnly disabled /></label>
                <label className="field span-2">Phone<input type="tel" maxLength="20" autoComplete="tel" placeholder="+91 98765 43210" value={profile.phone || ''} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} /></label>
                <label className="field span-2">Delivery address<textarea rows="3" maxLength="500" autoComplete="street-address" placeholder="House / flat, street, city, state, PIN code" value={profile.deliveryAddress || ''} onChange={(event) => setProfile((current) => ({ ...current, deliveryAddress: event.target.value }))} /></label>
              </div>
              <button className="btn btn-primary" type="submit" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save changes'}</button>
            </form>
          )}

          {tab === 'security' && (
            <div className="card panel form-panel">
              <div className="panel-head"><div><h2>Change password</h2><p>Use at least 12 characters.</p></div></div>
              <form className="form-stack" onSubmit={changePassword}>
                <label className="field">Current password<input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
                <label className="field">New password<input required type="password" minLength="12" maxLength="72" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
                <label className="field">Confirm new password<input required type="password" minLength="12" maxLength="72" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
                  <button className="btn btn-primary" type="submit" disabled={savingPassword}><LockKeyhole size={15} /> {savingPassword ? 'Updating…' : 'Update password'}</button>
                  <button className="link-btn" type="button" onClick={() => navigate(`/forgot-password?email=${encodeURIComponent(profile.email || '')}`)}>Forgot your current password?</button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </section>
  );
}

const STATUS = {
  paid: ['Purchased', 'badge badge-success'],
  pending: ['Reserved · awaiting confirmation', 'badge badge-warning'],
  cancelled: ['Cancelled', 'badge'],
  refunding: ['Refund in progress', 'badge badge-warning'],
  refunded: ['Refunded', 'badge'],
  expired: ['Reservation expired', 'badge'],
};
const PAYMENT = { dealership: 'Pay at dealership', callback: 'Call back requested', legacy_online: 'Paid online' };

export function CustomerOrderRow({ order, compact = false }) {
  const [label, tone] = STATUS[order.status] || [order.status, 'badge'];
  return (
    <article className="order-row">
      <div className="thumb">{order.vehicle.imageUrl ? <img src={order.vehicle.imageUrl} alt="" loading="lazy" /> : <CarFront size={22} />}</div>
      <div className="order-main">
        <strong>{order.vehicle.year ? `${order.vehicle.year} ` : ''}{order.vehicle.make} {order.vehicle.model}</strong>
        <small>#{order.id.slice(0, 8).toUpperCase()} · {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</small>
        {!compact && (
          <div className="order-extra">
            {order.paymentMethod && <span>{PAYMENT[order.paymentMethod] || order.paymentMethod}</span>}
            {order.deliveryAddress && <span>Deliver to: {order.deliveryAddress}</span>}
          </div>
        )}
      </div>
      <div className="order-side">
        <span className={tone}>{label}</span>
        <strong>{money(order.totalAmount)}</strong>
      </div>
    </article>
  );
}

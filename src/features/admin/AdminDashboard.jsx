import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, CircleAlert, Plus, Search, X } from 'lucide-react';
import { money } from '../../lib/currency-format.js';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility.js';

const ENQUIRY_STATUSES = [['new', 'New'], ['contacted', 'Contacted'], ['in_progress', 'In progress'], ['resolved', 'Resolved']];
const formatDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export function AdminDashboard({ api, onUnauthorized, onInventory }) {
  const [dashboard, setDashboard] = useState(null);
  const [orders, setOrders] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0, total: 0 });
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [reload, setReload] = useState(0);
  const [restockVehicle, setRestockVehicle] = useState(null);
  const [restockAmount, setRestockAmount] = useState('1');
  const [restocking, setRestocking] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const restockDialogRef = useRef(null);
  const confirmDialogRef = useRef(null);
  useDialogAccessibility(restockDialogRef, () => setRestockVehicle(null), Boolean(restockVehicle));
  useDialogAccessibility(confirmDialogRef, () => setConfirmAction(null), Boolean(confirmAction));

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(pagination.page), pageSize: '10' });
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    setLoading(true);
    setError('');
    Promise.all([api('/api/admin/dashboard'), api(`/api/admin/enquiries?${params}`), api('/api/admin/orders')])
      .then(([summary, result, orderResult]) => {
        if (active) {
          setDashboard(summary);
          setEnquiries(result.enquiries);
          setOrders(orderResult.orders);
          setPagination(result.pagination);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.message);
          if (requestError.status === 401 || requestError.status === 403) onUnauthorized();
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, onUnauthorized, pagination.page, reload, search, status]);

  async function updateEnquiry(id, nextStatus) {
    setUpdatingId(id);
    setError('');
    setSuccess('');
    try {
      const result = await api(`/api/admin/enquiries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setEnquiries((current) => current.map((item) => item.id === id ? result.enquiry : item));
      setDashboard((current) => current ? {
        ...current,
        enquiries: {
          ...current.enquiries,
          pending: current.enquiries.pending + (result.enquiry.status === 'new' ? 1 : 0)
            - (enquiries.find((item) => item.id === id)?.status === 'new' ? 1 : 0),
        },
        recentEnquiries: current.recentEnquiries.map((item) => item.id === id ? result.enquiry : item),
      } : current);
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.status === 401 || requestError.status === 403) onUnauthorized();
    } finally {
      setUpdatingId('');
    }
  }

  async function updateOrder(order, nextStatus) {
    setConfirmAction(null);
    setUpdatingId(order.id);
    setError('');
    setSuccess('');
    try {
      await api(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setOrders((current) => current.filter((item) => item.id !== order.id));
      setSuccess(nextStatus === 'paid' ? `Payment recorded for ${order.customerName}'s ${order.vehicle.make} ${order.vehicle.model}.` : 'Order cancelled and the car is back in stock.');
      setReload((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.status === 401 || requestError.status === 403) onUnauthorized();
      else setReload((current) => current + 1);
    } finally {
      setUpdatingId('');
    }
  }

  function applySearch(event) {
    event.preventDefault();
    setPagination((current) => ({ ...current, page: 1 }));
    setSearch(searchInput.trim());
  }

  async function submitRestock(event) {
    event.preventDefault();
    if (!restockVehicle) return;
    const quantity = Number(restockAmount);
    if (!Number.isInteger(quantity) || quantity < 1) return;
    setRestocking(true);
    setError('');
    setSuccess('');
    try {
      const result = await api(`/api/vehicles/${restockVehicle.id}/restock`, {
        method: 'POST',
        body: JSON.stringify({ quantity }),
      });
      const previousQuantity = restockVehicle.quantity;
      const updatedVehicle = result.vehicle;
      setDashboard((current) => current ? {
        ...current,
        inventory: {
          ...current.inventory,
          availableVehicles: current.inventory.availableVehicles
            + (updatedVehicle.status === 'listed' && previousQuantity === 0 ? 1 : 0),
          soldVehicles: current.inventory.soldVehicles
            - (updatedVehicle.status === 'listed' && previousQuantity === 0 ? 1 : 0),
          inventoryValue: current.inventory.inventoryValue + (updatedVehicle.price * quantity),
        },
        recentVehicles: current.recentVehicles.map((vehicle) => (
          vehicle.id === updatedVehicle.id ? updatedVehicle : vehicle
        )),
      } : current);
      setSuccess(`Added ${quantity} ${quantity === 1 ? 'unit' : 'units'} of ${updatedVehicle.make} ${updatedVehicle.model}.`);
      setRestockVehicle(null);
      setRestockAmount('1');
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.status === 401 || requestError.status === 403) onUnauthorized();
    } finally {
      setRestocking(false);
    }
  }

  return (
    <section className="container page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Dealer console</p>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-lede">Orders, customer enquiries, and stock at a glance.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={onInventory}><Plus size={16} /> Manage inventory</button>
      </div>
      {error && <div className="alert alert-error" role="alert" style={{ marginBottom: 16 }}><CircleAlert size={16} /><span>{error}</span><button type="button" onClick={() => setReload((current) => current + 1)}>Retry</button></div>}
      {success && <div className="alert alert-success" role="status" style={{ marginBottom: 16 }}><Check size={16} /><span>{success}</span><button type="button" aria-label="Dismiss" onClick={() => setSuccess('')}><X size={15} /></button></div>}
      {loading && !dashboard ? <div className="loading-block"><span className="spinner" /> Loading dashboard…</div> : dashboard && (
        <>
          <div className="stat-grid cols-5">
            <article className={`card stat ${orders.length ? 'is-alert' : ''}`}><span>Orders to action</span><strong>{orders.length}</strong><small>Awaiting confirmation</small></article>
            <article className={`card stat ${dashboard.enquiries.pending ? 'is-alert' : ''}`}><span>New enquiries</span><strong>{dashboard.enquiries.pending}</strong><small>{dashboard.enquiries.total} total</small></article>
            <article className="card stat"><span>Vehicles</span><strong>{dashboard.inventory.totalVehicles}</strong><small>{dashboard.inventory.availableVehicles} available</small></article>
            <article className="card stat"><span>Sold out</span><strong>{dashboard.inventory.soldVehicles}</strong><small>Need restocking</small></article>
            <article className="card stat"><span>Stock value</span><strong style={{ fontSize: 22 }}>{money(dashboard.inventory.inventoryValue)}</strong><small>Listed inventory</small></article>
          </div>

          <div className="admin-stack">
            <section className="card panel">
              <div className="panel-head"><div><h2>Orders awaiting action</h2><p>Contact the customer, then confirm payment or cancel.</p></div><span className={orders.length ? 'badge badge-accent' : 'badge'}>{orders.length} open</span></div>
              {orders.length ? (
                <div className="table-wrap"><table className="table"><thead><tr><th scope="col">Customer</th><th scope="col">Vehicle</th><th scope="col">Payment</th><th scope="col" className="num">Total</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>{orders.map((order) => (
                    <tr key={order.id}>
                      <td><strong>{order.customerName}</strong><a className="sub" href={`mailto:${order.email}`}>{order.email}</a>{order.phone && <a className="sub" href={`tel:${order.phone}`}>{order.phone}</a>}</td>
                      <td><strong>{order.vehicle.make} {order.vehicle.model}</strong><small>Placed {formatDate(order.createdAt)}</small></td>
                      <td>{order.paymentMethod === 'callback' ? <span className="badge badge-warning">Call back</span> : <span className="badge">At dealership</span>}</td>
                      <td className="num"><strong>{money(order.totalAmount)}</strong></td>
                      <td><div className="row-actions">
                        <button className="btn btn-secondary btn-sm" type="button" disabled={updatingId === order.id} onClick={() => setConfirmAction({ order, status: 'cancelled' })}>Cancel</button>
                        <button className="btn btn-dark btn-sm" type="button" disabled={updatingId === order.id} onClick={() => setConfirmAction({ order, status: 'paid' })}>Mark paid</button>
                      </div></td>
                    </tr>
                  ))}</tbody>
                </table></div>
              ) : <p className="panel-empty">You’re all caught up — no orders need attention.</p>}
            </section>

            <div className="two-col">
              <section className="card panel">
                <div className="panel-head"><div><h2>Stock levels</h2><p>Most recently added vehicles</p></div><button className="link-btn" type="button" onClick={onInventory}>View all <ArrowRight size={14} style={{ verticalAlign: '-2px' }} /></button></div>
                {dashboard.recentVehicles.length ? (
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr><th scope="col">Vehicle</th><th scope="col">Status</th><th scope="col" className="num">Stock</th><th scope="col" className="num">Price</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                      <tbody>{dashboard.recentVehicles.map((vehicle) => (
                        <tr key={vehicle.id}>
                          <td><strong>{vehicle.make} {vehicle.model}</strong><small>{[vehicle.year, vehicle.category].filter(Boolean).join(' · ')}</small></td>
                          <td>{vehicle.status === 'unlisted' ? <span className="badge">Hidden</span> : vehicle.quantity < 1 ? <span className="badge badge-danger">Sold out</span> : <span className="badge badge-success">Listed</span>}</td>
                          <td className="num">{vehicle.quantity}</td>
                          <td className="num">{money(vehicle.price)}</td>
                          <td><div className="row-actions"><button className="btn btn-secondary btn-sm" type="button" onClick={() => { setRestockVehicle(vehicle); setRestockAmount('1'); }}>Restock</button></div></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p className="panel-empty">No vehicles yet. Add your first one from Inventory.</p>}
              </section>
              <section className="card panel">
                <div className="panel-head"><div><h2>Inventory mix</h2><p>Vehicles by make and fuel</p></div></div>
                <AdminBreakdown title="By make" groups={dashboard.groups.make} />
                <AdminBreakdown title="By fuel type" groups={dashboard.groups.fuelType} />
              </section>
            </div>

            <section className="card panel">
              <div className="panel-head"><div><h2>Customer enquiries</h2><p>{pagination.total} total</p></div></div>
              <form className="filter-row" onSubmit={applySearch}>
                <label className="search"><Search size={16} /><span className="sr-only">Search enquiries</span><input className="input" placeholder="Search by name, email, or subject" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></label>
                <label><span className="sr-only">Filter by status</span><select className="input" value={status} onChange={(event) => { setStatus(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }}><option value="">All statuses</option>{ENQUIRY_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <button className="btn btn-dark" type="submit">Search</button>
              </form>
              {enquiries.length ? (
                <div className="table-wrap"><table className="table"><thead><tr><th scope="col">Customer</th><th scope="col">Message</th><th scope="col">Vehicle</th><th scope="col">Received</th><th scope="col">Status</th></tr></thead>
                  <tbody>{enquiries.map((enquiry) => (
                    <tr key={enquiry.id}>
                      <td><strong>{enquiry.customerName}</strong><a className="sub" href={`mailto:${enquiry.email}`}>{enquiry.email}</a>{enquiry.phone && <a className="sub" href={`tel:${enquiry.phone}`}>{enquiry.phone}</a>}</td>
                      <td><strong>{enquiry.subject}</strong><p>{enquiry.message}</p></td>
                      <td>{enquiry.vehicle ? `${enquiry.vehicle.make} ${enquiry.vehicle.model}` : <span className="sub">General</span>}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(enquiry.createdAt)}</td>
                      <td><select className="input" aria-label={`Status for ${enquiry.customerName}`} disabled={updatingId === enquiry.id} value={enquiry.status} onChange={(event) => updateEnquiry(enquiry.id, event.target.value)}>{ENQUIRY_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
                    </tr>
                  ))}</tbody>
                </table></div>
              ) : <p className="panel-empty">{loading ? 'Loading…' : search || status ? 'No enquiries match these filters.' : 'No enquiries yet.'}</p>}
              {pagination.totalPages > 1 && (
                <nav className="pagination" aria-label="Enquiry pages">
                  <span>Page {pagination.page} of {pagination.totalPages}</span>
                  <div>
                    <button className="btn btn-secondary btn-sm" type="button" disabled={pagination.page <= 1 || loading} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>
                    <button className="btn btn-secondary btn-sm" type="button" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
                  </div>
                </nav>
              )}
            </section>
          </div>
        </>
      )}

      {restockVehicle && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setRestockVehicle(null); }}>
          <form className="modal" style={{ width: 'min(420px, 100%)' }} ref={restockDialogRef} role="dialog" aria-modal="true" aria-labelledby="restock-title" onSubmit={submitRestock} tabIndex="-1">
            <div className="modal-head">
              <div><h2 id="restock-title">Restock {restockVehicle.make} {restockVehicle.model}</h2><p>Currently {restockVehicle.quantity} in stock.</p></div>
              <button className="icon-btn" type="button" aria-label="Close" onClick={() => setRestockVehicle(null)}><X size={18} /></button>
            </div>
            <label className="field">Units to add
              <input autoFocus required type="number" min="1" max={Math.max(1_000_000 - restockVehicle.quantity, 0)} step="1" value={restockAmount} onChange={(event) => setRestockAmount(event.target.value)} />
            </label>
            <div className="modal-foot">
              <button className="btn btn-secondary" type="button" disabled={restocking} onClick={() => setRestockVehicle(null)}>Cancel</button>
              <button className="btn btn-primary" type="submit" disabled={restocking || restockVehicle.quantity >= 1_000_000}>{restocking ? 'Updating…' : 'Add stock'}</button>
            </div>
          </form>
        </div>
      )}

      {confirmAction && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmAction(null); }}>
          <div className="modal" style={{ width: 'min(440px, 100%)' }} ref={confirmDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" tabIndex="-1">
            <div className="modal-head">
              <div>
                <h2 id="confirm-title">{confirmAction.status === 'paid' ? 'Confirm payment received?' : 'Cancel this order?'}</h2>
                <p>{confirmAction.status === 'paid'
                  ? `Only confirm once ${money(confirmAction.order.totalAmount)} has been received for the ${confirmAction.order.vehicle.make} ${confirmAction.order.vehicle.model}.`
                  : `The ${confirmAction.order.vehicle.make} ${confirmAction.order.vehicle.model} will be released back into stock.`}</p>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-secondary" type="button" onClick={() => setConfirmAction(null)}>Go back</button>
              <button className={confirmAction.status === 'paid' ? 'btn btn-dark' : 'btn btn-danger'} type="button" onClick={() => updateOrder(confirmAction.order, confirmAction.status)}>
                {confirmAction.status === 'paid' ? 'Yes, mark as paid' : 'Yes, cancel order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function AdminMetric({ title, value, detail }) {
  return <article className="card stat"><span>{title}</span><strong>{value}</strong><small>{detail}</small></article>;
}

export function AdminBreakdown({ title, groups }) {
  const visible = groups.filter((group) => group.label && !/not recorded/i.test(group.label));
  const maximum = Math.max(1, ...visible.map((group) => group.count));
  return (
    <div className="bar-group">
      <h3>{title}</h3>
      {visible.length ? visible.map((group) => (
        <div className="bar-row" key={group.label}>
          <span>{group.label}</span>
          <div className="bar-track"><span style={{ width: `${Math.max(6, (group.count / maximum) * 100)}%` }} /></div>
          <strong>{group.count}</strong>
        </div>
      )) : <p className="panel-empty" style={{ padding: '8px 0' }}>No data yet.</p>}
    </div>
  );
}

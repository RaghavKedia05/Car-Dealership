import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CarFront, Check, Search, X } from 'lucide-react';
import { money } from '../../lib/currency-format.js';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility.js';

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
  const restockDialogRef = useRef(null);
  useDialogAccessibility(restockDialogRef, () => setRestockVehicle(null), Boolean(restockVehicle));

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
    const action = nextStatus === 'paid'
      ? `confirm ${money(order.totalAmount)} received for ${order.vehicle.make} ${order.vehicle.model}? Only continue after the dealership has actually received payment.`
      : `cancel the ${order.vehicle.make} ${order.vehicle.model} order and release its reservation?`;
    if (!window.confirm(action)) return;
    setUpdatingId(order.id);
    setError('');
    setSuccess('');
    try {
      await api(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setOrders((current) => current.filter((item) => item.id !== order.id));
      setSuccess(nextStatus === 'paid' ? 'Payment was recorded and the purchase is now in the customer order history.' : 'Order cancelled and the vehicle returned to available stock.');
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
      setSuccess(`${updatedVehicle.make} ${updatedVehicle.model} restocked by ${quantity} ${quantity === 1 ? 'unit' : 'units'}.`);
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
    <section className="admin-dashboard">
      <div className="admin-page-heading">
        <div><p className="eyebrow"><span className="eyebrow-line" /> DEALERSHIP OPERATIONS</p><h1>Admin <span>dashboard.</span></h1><p>Orders, customer enquiries, and live inventory from your dealership database.</p></div>
        <button className="public-button" type="button" onClick={onInventory}>Manage inventory <CarFront size={16} /></button>
      </div>
      {error && <div className="notice notice-error" role="alert">{error}<button type="button" onClick={() => setReload((current) => current + 1)}>Retry</button></div>}
      {success && <div className="notice notice-success" role="status"><Check size={17} /> {success}<button type="button" aria-label="Dismiss notification" onClick={() => setSuccess('')}><X size={15} /></button></div>}
      {loading && !dashboard ? <div className="empty-state"><div className="loading-spinner" /><p>Loading dealership data…</p></div> : dashboard && (
        <>
          <div className="admin-metric-grid">
            <AdminMetric title="Vehicles in inventory" value={dashboard.inventory.totalVehicles} detail={`${dashboard.inventory.availableVehicles} listed with stock`} />
            <AdminMetric title="Inventory value" value={money(dashboard.inventory.inventoryValue)} detail="Current listed stock" />
            <AdminMetric title="Enquiries" value={dashboard.enquiries.total} detail={`${dashboard.enquiries.pending} new`} />
            <AdminMetric title="Sold out" value={dashboard.inventory.soldVehicles} detail="Listed, currently out of stock" />
            <AdminMetric title="Orders awaiting action" value={orders.length} detail="Contact customer or confirm payment" />
          </div>
          <div className="admin-data-grid">
            <section className="admin-panel"><div className="admin-panel-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> INVENTORY SNAPSHOT</p><h2>What’s in the <span>collection.</span></h2></div></div>
              <AdminBreakdown title="By make" groups={dashboard.groups.make} />
              <AdminBreakdown title="By body type" groups={dashboard.groups.bodyType} />
              <AdminBreakdown title="By fuel" groups={dashboard.groups.fuelType} />
            </section>
            <section className="admin-panel"><div className="admin-panel-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> FLEET TELEMETRY</p><h2>Recent <span>allocations.</span></h2></div><button className="stitch-table-action" type="button" onClick={onInventory}>Manage inventory <ArrowUpRight size={15} /></button></div>
              {dashboard.recentVehicles.length ? (
                <div className="stitch-stock-table-wrap">
                  <table className="stitch-stock-table">
                    <thead><tr><th scope="col">Vehicle</th><th scope="col">Listing</th><th scope="col">Available</th><th scope="col">Unit price</th><th scope="col">Action</th></tr></thead>
                    <tbody>{dashboard.recentVehicles.map((vehicle) => (
                      <tr key={vehicle.id}>
                        <td><strong>{vehicle.make} {vehicle.model}</strong><span>{vehicle.year || vehicle.category}</span></td>
                        <td><span className={`stitch-stock-status ${vehicle.status}`}>{vehicle.status}</span></td>
                        <td>{vehicle.quantity}</td>
                        <td>{money(vehicle.price)}</td>
                        <td><button className="stitch-restock-button" type="button" onClick={() => { setRestockVehicle(vehicle); setRestockAmount('1'); }}>Restock</button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <p className="admin-empty">No vehicle listings have been added yet.</p>}
            </section>
          </div>
          <section className="admin-panel admin-order-inbox">
            <div className="admin-panel-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> VEHICLE SALES</p><h2>Order <span>requests.</span></h2></div><span className="admin-total">{orders.length} awaiting action</span></div>
            {orders.length ? (
              <div className="admin-table-wrap"><table className="admin-enquiry-table"><thead><tr><th scope="col">Customer</th><th scope="col">Vehicle</th><th scope="col">Total</th><th scope="col">Payment plan</th><th scope="col">Action</th></tr></thead>
                <tbody>{orders.map((order) => <tr key={order.id}>
                  <td><strong>{order.customerName}</strong><a href={`mailto:${order.email}`}>{order.email}</a>{order.phone && <a href={`tel:${order.phone}`}>{order.phone}</a>}<p>{order.deliveryAddress}</p></td>
                  <td>{order.vehicle.year ? `${order.vehicle.year} ` : ''}{order.vehicle.make} {order.vehicle.model}<p>Received {new Date(order.createdAt).toLocaleDateString()}</p></td>
                  <td>{money(order.totalAmount)}</td>
                  <td>{order.paymentMethod === 'callback' ? 'Callback requested' : 'Pay at dealership'}</td>
      <td><div className="admin-order-actions"><button type="button" disabled={updatingId === order.id} onClick={() => updateOrder(order, 'paid')}>Confirm paid</button><button type="button" disabled={updatingId === order.id} onClick={() => updateOrder(order, 'cancelled')}>Cancel</button></div></td>
                </tr>)}</tbody>
              </table></div>
            ) : <p className="admin-empty">There are no orders awaiting dealership action.</p>}
          </section>
          <section className="admin-panel admin-enquiries">
            <div className="admin-panel-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> CUSTOMER MESSAGES</p><h2>Enquiry <span>inbox.</span></h2></div><span className="admin-total">{pagination.total} total</span></div>
            <form className="admin-enquiry-filters" onSubmit={applySearch}>
              <label className="search-field"><Search size={16} /><input aria-label="Search enquiries" placeholder="Search name, email, or subject" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></label>
              <label className="select-field"><span className="sr-only">Filter enquiries by status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }}><option value="">All statuses</option><option value="new">New</option><option value="contacted">Contacted</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></label>
              <button className="public-button" type="submit">Search</button>
            </form>
            {enquiries.length ? (
              <div className="admin-table-wrap"><table className="admin-enquiry-table"><thead><tr><th scope="col">Customer</th><th scope="col">Enquiry</th><th scope="col">Vehicle</th><th scope="col">Received</th><th scope="col">Status</th></tr></thead>
                <tbody>{enquiries.map((enquiry) => <tr key={enquiry.id}><td><strong>{enquiry.customerName}</strong><a href={`mailto:${enquiry.email}`}>{enquiry.email}</a>{enquiry.phone && <a href={`tel:${enquiry.phone}`}>{enquiry.phone}</a>}</td><td><strong>{enquiry.subject}</strong><p>{enquiry.message}</p></td><td>{enquiry.vehicle ? `${enquiry.vehicle.make} ${enquiry.vehicle.model}` : 'General'}</td><td>{new Date(enquiry.createdAt).toLocaleDateString()}</td><td><select aria-label={`Update status for ${enquiry.customerName}'s enquiry`} disabled={updatingId === enquiry.id} value={enquiry.status} onChange={(event) => updateEnquiry(enquiry.id, event.target.value)}><option value="new">New</option><option value="contacted">Contacted</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></td></tr>)}</tbody>
              </table></div>
            ) : <p className="admin-empty">{loading ? 'Loading enquiries…' : 'No enquiries match these filters.'}</p>}
            {pagination.totalPages > 1 && <nav className="inventory-pagination" aria-label="Enquiry pages"><button type="button" disabled={pagination.page <= 1 || loading} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}>Previous</button><span>Page {pagination.page} of {pagination.totalPages}</span><button type="button" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}>Next</button></nav>}
          </section>
        </>
      )}
      {restockVehicle && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setRestockVehicle(null); }}>
          <form className="stitch-restock-dialog" ref={restockDialogRef} role="dialog" aria-modal="true" aria-labelledby="restock-title" onSubmit={submitRestock} tabIndex="-1">
            <div className="editor-header">
              <div><p className="eyebrow"><span className="eyebrow-line" /> LIVE STOCK CONTROL</p><h2 id="restock-title">Restock {restockVehicle.make} {restockVehicle.model}</h2></div>
              <button className="icon-button" type="button" aria-label="Close restock dialog" onClick={() => setRestockVehicle(null)}><X size={18} /></button>
            </div>
            <p>Current allocation: <strong>{restockVehicle.quantity}</strong></p>
            <label className="form-label">UNITS TO ADD
              <input
                autoFocus
                required
                type="number"
                min="1"
                max={Math.max(1_000_000 - restockVehicle.quantity, 0)}
                step="1"
                value={restockAmount}
                onChange={(event) => setRestockAmount(event.target.value)}
              />
            </label>
            <div className="stitch-restock-actions">
              <button className="finder-secondary" type="button" disabled={restocking} onClick={() => setRestockVehicle(null)}>Cancel</button>
              <button className="public-button" type="submit" disabled={restocking || restockVehicle.quantity >= 1_000_000}>
                {restocking ? 'Updating stock…' : 'Confirm restock'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

export function AdminMetric({ title, value, detail }) {
  return <article className="admin-metric"><span>{title}</span><strong>{value}</strong><small>{detail}</small></article>;
}

export function AdminBreakdown({ title, groups }) {
  const maximum = Math.max(1, ...groups.map((group) => group.count));
  return <div className="admin-breakdown"><h3>{title}</h3>{groups.length ? groups.map((group) => <div className="admin-bar-row" key={group.label}><span>{group.label}</span><div className="admin-bar-track"><span style={{ width: `${Math.max(5, (group.count / maximum) * 100)}%` }} /></div><strong>{group.count}</strong></div>) : <p className="admin-empty">No data recorded.</p>}</div>;
}

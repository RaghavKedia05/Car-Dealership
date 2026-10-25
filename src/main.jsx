import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight,
  BadgeCheck,
  CarFront,
  Check,
  ChevronDown,
  CircleHelp,
  Gauge,
  KeyRound,
  LockKeyhole,
  LogOut,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import './styles.css';

const CATEGORIES = ['SUV', 'Sedan', 'Truck', 'Coupe', 'Hatchback', 'Wagon', 'Van', 'Electric', 'Other'];

function getStoredSession() {
  const token = localStorage.getItem('northline-token');
  const storedUser = localStorage.getItem('northline-user');
  if (!token || !storedUser) return null;
  try {
    return { token, user: JSON.parse(storedUser) };
  } catch (error) {
    console.error('Could not restore the saved account session:', error);
    localStorage.removeItem('northline-token');
    localStorage.removeItem('northline-user');
    return null;
  }
}

function money(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function App() {
  const [session, setSession] = useState(getStoredSession);
  const [authMode, setAuthMode] = useState('login');
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 9, total: 0, totalPages: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const [editor, setEditor] = useState(null);
  const [mobileFilters, setMobileFilters] = useState(false);
  const isAdmin = session?.user.role === 'admin';

  async function api(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
        ...options.headers,
      },
    });
    if (response.status === 204) return null;
    const body = await response.json();
    if (!response.ok) {
      const requestError = new Error(body.error || 'Something went wrong. Please try again.');
      requestError.status = response.status;
      throw requestError;
    }
    return body;
  }

  useEffect(() => {
    if (!session) return undefined;
    const search = new URLSearchParams();
    if (make.trim()) search.set('make', make.trim());
    if (model.trim()) search.set('model', model.trim());
    if (category) search.set('category', category);
    if (minPrice) search.set('minPrice', minPrice);
    if (maxPrice) search.set('maxPrice', maxPrice);
    search.set('page', String(page));
    search.set('pageSize', String(pagination.pageSize));
    search.set('sortBy', sortBy);
    search.set('sortOrder', sortOrder);
    const query = search.toString();
    const endpoint = `/api/vehicles/search?${query}`;
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const result = await api(endpoint);
        if (active) {
          setVehicles(result.vehicles);
          setPagination(result.pagination);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message);
          if (requestError.status === 401) signOut();
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [session, make, model, category, minPrice, maxPrice, page, pagination.pageSize, sortBy, sortOrder, refreshKey]);

  useEffect(() => {
    setPage(1);
  }, [make, model, category, minPrice, maxPrice, sortBy, sortOrder]);

  function saveSession(nextSession) {
    localStorage.setItem('northline-token', nextSession.token);
    localStorage.setItem('northline-user', JSON.stringify(nextSession.user));
    setSession(nextSession);
    setError('');
    setNotice('');
  }

  function signOut() {
    localStorage.removeItem('northline-token');
    localStorage.removeItem('northline-user');
    setSession(null);
    setVehicles([]);
    setNotice('You have been signed out.');
  }

  async function handlePurchase(vehicle) {
    setBusyId(vehicle.id);
    setError('');
    setNotice('');
    try {
      const result = await api(`/api/vehicles/${vehicle.id}/purchase`, { method: 'POST' });
      setVehicles((current) => current.map((item) => item.id === vehicle.id ? result.vehicle : item));
      setRefreshKey((current) => current + 1);
      setNotice(`${vehicle.make} ${vehicle.model} purchased. Inventory has been updated.`);
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.status === 401) signOut();
    } finally {
      setBusyId(null);
    }
  }

  async function saveVehicle(event) {
    event.preventDefault();
    setBusyId('editor');
    setError('');
    const editing = Boolean(editor.vehicle);
    try {
      const result = await api(
        editing ? `/api/vehicles/${editor.vehicle.id}` : '/api/vehicles',
        {
          method: editing ? 'PUT' : 'POST',
          body: JSON.stringify({
            make: editor.make.trim(),
            model: editor.model.trim(),
            category: editor.category,
            price: Number(editor.price),
            quantity: Number(editor.quantity),
          }),
        },
      );
      setVehicles((current) => editing
        ? current.map((item) => item.id === result.vehicle.id ? result.vehicle : item)
        : [result.vehicle, ...current]);
      setRefreshKey((current) => current + 1);
      setEditor(null);
      setNotice(editing ? 'Vehicle details updated.' : 'New vehicle added to the showroom.');
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.status === 401) signOut();
    } finally {
      setBusyId(null);
    }
  }

  async function deleteVehicle(vehicle) {
    if (!window.confirm(`Remove the ${vehicle.make} ${vehicle.model} from the inventory?`)) return;
    setBusyId(vehicle.id);
    setError('');
    try {
      await api(`/api/vehicles/${vehicle.id}`, { method: 'DELETE' });
      setVehicles((current) => current.filter((item) => item.id !== vehicle.id));
      const remainingPages = Math.ceil((pagination.total - 1) / pagination.pageSize);
      if (page > Math.max(remainingPages, 1)) setPage(Math.max(remainingPages, 1));
      setRefreshKey((current) => current + 1);
      setNotice(`${vehicle.make} ${vehicle.model} was removed from the inventory.`);
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.status === 401) signOut();
    } finally {
      setBusyId(null);
    }
  }

  function clearFilters() {
    setMake('');
    setModel('');
    setCategory('');
    setMinPrice('');
    setMaxPrice('');
  }

  const hasFilters = make || model || category || minPrice || maxPrice;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="site-header">
        <a className="brand" href="#" aria-label="Northline Motors home">
          <span className="brand-mark"><CarFront size={21} strokeWidth={1.8} /></span>
          <span className="brand-name">NORTHLINE<span>MOTORS</span></span>
        </a>
        <nav className="header-nav" aria-label="Main navigation">
          <a className="nav-link active" href="#inventory">The collection</a>
          <a className="nav-link" href="#about">Our approach</a>
        </nav>
        {session ? (
          <div className="header-account">
            {isAdmin && <span className="admin-indicator"><ShieldCheck size={14} /> ADMIN</span>}
            <span className="account-name">{session.user.name.split(' ')[0]}</span>
            <button className="icon-button" type="button" onClick={signOut} aria-label="Sign out" title="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <a className="header-signin" href="#account">Member sign in <ArrowUpRight size={16} /></a>
        )}
      </header>

      <main>
        <section className="hero" id="about">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> A more considered way to drive</p>
            <h1>Find your<br />next <span>great drive.</span></h1>
            <p className="hero-description">
              Explore the current collection, compare the details, and find a vehicle that fits your next chapter.
            </p>
            {session ? (
              <a className="hero-link" href="#inventory">Explore the collection <ArrowUpRight size={16} /></a>
            ) : (
              <a className="hero-link" href="#account">Discover the collection <ArrowUpRight size={16} /></a>
            )}
            <div className="hero-proof">
              <div className="proof-icon"><BadgeCheck size={17} /></div>
              <span>A clear view of every listing.</span>
            </div>
          </div>
          <div className="hero-art" aria-label="Illustration of a premium sports car">
            <div className="hero-glow" />
            <div className="art-sun" />
            <span className="art-index">N° 01 <span>THE COLLECTION</span></span>
            <div className="art-lines" />
            <CarFront className="hero-car" strokeWidth={0.8} aria-hidden="true" />
            <div className="art-caption"><span>THE ROAD IS YOURS</span><span>EST. 2014 — NORTHLINE</span></div>
          </div>
          <div className="hero-footer">
            <span>INDEPENDENT BY NATURE</span>
            <span>YOUR NEXT DRIVE STARTS HERE <ArrowUpRight size={13} /></span>
          </div>
        </section>

        <section className="collection-section" id="inventory">
          <div className="section-heading">
            <div>
              <p className="eyebrow"><span className="eyebrow-line" /> THE NORTHLINE EDIT</p>
              <h2>Find your <span>fit.</span></h2>
            </div>
            {session && (
              <div className="collection-meta">
                <span className="inventory-count">{loading ? '…' : String(pagination.total).padStart(2, '0')}</span>
                <span>CURATED VEHICLES</span>
              </div>
            )}
          </div>

          {session ? (
            <>
              <div className="toolbar">
                <div className={`filters-panel ${mobileFilters ? 'filters-open' : ''}`}>
                  <label className="search-field">
                    <Search size={17} />
                    <input aria-label="Search make" placeholder="Make — e.g. Volvo" value={make} onChange={(event) => setMake(event.target.value)} />
                  </label>
                  <label className="search-field">
                    <CarFront size={17} />
                    <input aria-label="Search model" placeholder="Model — e.g. XC60" value={model} onChange={(event) => setModel(event.target.value)} />
                  </label>
                  <label className="select-field">
                    <SlidersHorizontal size={16} />
                    <select aria-label="Vehicle category" value={category} onChange={(event) => setCategory(event.target.value)}>
                      <option value="">All categories</option>
                      {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <ChevronDown size={14} />
                  </label>
                  <div className="price-range">
                    <span className="price-prefix">PRICE</span>
                    <input aria-label="Minimum price" inputMode="numeric" placeholder="Min" type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} />
                    <Minus size={13} />
                    <input aria-label="Maximum price" inputMode="numeric" placeholder="Max" type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} />
                  </div>
                  <label className="sort-field">
                    <span>SORT</span>
                    <select aria-label="Sort vehicles by" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                      <option value="createdAt">Newest</option>
                      <option value="make">Make</option>
                      <option value="model">Model</option>
                      <option value="price">Price</option>
                    </select>
                  </label>
                  <button
                    className="sort-order"
                    type="button"
                    onClick={() => setSortOrder((current) => current === 'asc' ? 'desc' : 'asc')}
                    aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                  </button>
                  {hasFilters && <button className="clear-filters" type="button" onClick={clearFilters}>Clear</button>}
                </div>
                <button className="filter-toggle" type="button" onClick={() => setMobileFilters(!mobileFilters)} aria-expanded={mobileFilters}>
                  <SlidersHorizontal size={17} /> Filters
                </button>
                {isAdmin && (
                  <button className="add-vehicle" type="button" onClick={() => setEditor({ make: '', model: '', category: 'SUV', price: '', quantity: '1' })}>
                    <Plus size={16} /> Add vehicle
                  </button>
                )}
              </div>

              {error && (
                <div className="notice notice-error" role="alert">
                  <CircleHelp size={17} /> {error}
                  <button type="button" onClick={() => setRefreshKey((current) => current + 1)}>Retry</button>
                </div>
              )}
              {notice && <div className="notice notice-success" role="status"><Check size={17} /> {notice}<button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></div>}

              {loading && !vehicles.length ? (
                <div className="empty-state"><div className="loading-spinner" /><p>Curating your collection…</p></div>
              ) : vehicles.length ? (
                <div className="vehicle-grid">
                  {vehicles.map((vehicle, index) => (
                    <VehicleCard
                      key={vehicle.id}
                      vehicle={vehicle}
                      index={index}
                      isAdmin={isAdmin}
                      busy={busyId === vehicle.id}
                      onPurchase={handlePurchase}
                      onEdit={() => setEditor({
                        vehicle,
                        make: vehicle.make,
                        model: vehicle.model,
                        category: vehicle.category,
                        price: String(vehicle.price),
                        quantity: String(vehicle.quantity),
                      })}
                      onDelete={deleteVehicle}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon"><CarFront size={27} /></div>
                  <h3>{hasFilters ? 'Nothing in this lane.' : 'Your next great drive is on its way.'}</h3>
                  <p>{hasFilters ? 'Try widening your search or clearing a filter.' : 'Check back soon for thoughtfully sourced arrivals.'}</p>
                  {hasFilters && <button className="text-action" type="button" onClick={clearFilters}>Clear all filters <ArrowUpRight size={15} /></button>}
                </div>
              )}
              {pagination.total > 0 && (
                <nav className="inventory-pagination" aria-label="Inventory pages">
                  <span>
                    Showing {(pagination.page - 1) * pagination.pageSize + 1}–
                    {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
                  </span>
                  <div>
                    <button
                      type="button"
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((current) => current - 1)}
                    >
                      Previous
                    </button>
                    <span>Page {pagination.page} of {Math.max(pagination.totalPages, 1)}</span>
                    <button
                      type="button"
                      disabled={page >= pagination.totalPages || loading}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      Next
                    </button>
                  </div>
                </nav>
              )}
              <p className="inventory-note"><LockKeyhole size={13} /> Stock updates as purchases are made · Live inventory</p>
            </>
          ) : (
            <div className="account-section" id="account">
              <div className="account-intro">
                <div className="account-icon"><KeyRound size={20} /></div>
                <p className="eyebrow"><span className="eyebrow-line" /> YOUR PRIVATE SHOWROOM</p>
                <h3>A little closer<br />to <span>the right one.</span></h3>
                <p>Sign in to browse the current inventory, check live stock, and purchase an available vehicle.</p>
                <ul className="account-benefits">
                  <li><Check size={15} /> Current vehicle listings</li>
                  <li><Check size={15} /> Live stock availability</li>
                  <li><Check size={15} /> Clear vehicle details</li>
                </ul>
              </div>
              <AuthForm
                mode={authMode}
                setMode={setAuthMode}
                onAuthenticated={saveSession}
                setError={setError}
                error={error}
                notice={notice}
                setNotice={setNotice}
              />
            </div>
          )}
        </section>

        <section className="closing-note">
          <div className="closing-icon"><Sparkles size={18} /></div>
          <div><span>NOT JUST A CAR.</span><p>A better feeling about the road ahead.</p></div>
          <ArrowUpRight size={20} />
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#"><span className="brand-mark"><CarFront size={19} /></span><span className="brand-name">NORTHLINE<span>MOTORS</span></span></a>
        <span>VEHICLE LISTINGS. STOCK TRACKED LIVE.</span>
        <span>© {new Date().getFullYear()} NORTHLINE MOTORS</span>
      </footer>

      {editor && <VehicleEditor value={editor} setValue={setEditor} busy={busyId === 'editor'} onSubmit={saveVehicle} onClose={() => setEditor(null)} />}
    </div>
  );
}

function VehicleCard({ vehicle, index, isAdmin, busy, onPurchase, onEdit, onDelete }) {
  const soldOut = vehicle.quantity === 0;
  const variant = index % 4;

  return (
    <article className={`vehicle-card ${variant === 1 ? 'vehicle-card-sand' : ''} ${variant === 2 ? 'vehicle-card-blue' : ''}`}>
      <div className={`vehicle-artwork artwork-${variant}`}>
        <span className="vehicle-stock">{soldOut ? 'JUST LEFT' : `${String(vehicle.quantity).padStart(2, '0')} AVAILABLE`}</span>
        <div className="vehicle-art-number">0{String(index + 1).slice(-1)}</div>
        <div className="vehicle-art-circle" />
        <CarFront className="vehicle-illustration" strokeWidth={0.85} aria-hidden="true" />
        <span className="vehicle-art-label">NORTHLINE / SELECT</span>
      </div>
      <div className="vehicle-details">
        <div className="vehicle-heading">
          <div>
            <span className="vehicle-make">{vehicle.make}</span>
            <h3>{vehicle.model}</h3>
          </div>
          <span className="category-pill">{vehicle.category}</span>
        </div>
        <div className="vehicle-spec-row">
          <span><Gauge size={14} /> {vehicle.quantity > 0 ? 'IN STOCK' : 'OUT OF STOCK'}</span>
          <span><CarFront size={14} /> LIVE LISTING</span>
        </div>
        <div className="vehicle-card-footer">
          <div><span className="price-caption">YOUR NEXT CHAPTER FROM</span><span className="vehicle-price">{money(vehicle.price)}</span></div>
          <button
            className={`purchase-button ${soldOut ? 'purchase-disabled' : ''}`}
            type="button"
            disabled={soldOut || busy}
            onClick={() => onPurchase(vehicle)}
          >
            {busy ? <span className="loading-spinner spinner-small" /> : soldOut ? 'Sold out' : <>Purchase <ArrowUpRight size={15} /></>}
          </button>
        </div>
        {isAdmin && (
          <div className="vehicle-admin-actions">
            <button type="button" onClick={onEdit}><SlidersHorizontal size={14} /> Edit details & stock</button>
            <button type="button" onClick={() => onDelete(vehicle)}><X size={14} /> Remove</button>
          </div>
        )}
      </div>
    </article>
  );
}

function AuthForm({ mode, setMode, onAuthenticated, setError, error, notice, setNotice }) {
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
      const response = await fetch(`/api/auth/${registering ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(registering ? { name } : {}), email, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'We could not sign you in. Please try again.');
      if (registering) {
        setMode('login');
        setPassword('');
        setError('');
        setNotice('Your account is ready. Sign in to continue.');
        return;
      }
      onAuthenticated({ token: body.token, user: body.user });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="form-topline"><span>YOUR SHOWROOM, AWAITING</span><span>01 / 02</span></div>
      <h3>{registering ? 'Make yourself at home.' : 'Welcome back.'}</h3>
      <p>{registering ? 'Create your account. Your next favourite is just around the corner.' : 'A little something good is waiting on the other side.'}</p>
      {notice && <div className="form-success" role="status"><Check size={15} /> {notice}</div>}
      {error && <div className="form-error" role="alert"><CircleHelp size={16} /> {error}</div>}
      {registering && <label className="form-label">YOUR NAME<input required minLength="2" maxLength="80" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex Morgan" /></label>}
      <label className="form-label">EMAIL ADDRESS<input required type="email" maxLength="254" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
      <label className="form-label">PASSWORD<input required type="password" minLength={registering ? 12 : 1} maxLength="72" autoComplete={registering ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={registering ? 'At least 12 characters' : 'Your password'} /></label>
      <button className="auth-submit" disabled={submitting} type="submit">{submitting ? 'One moment…' : registering ? 'Create your account' : 'Enter your showroom'} <ArrowUpRight size={16} /></button>
      <div className="auth-switch">
        <span>{registering ? 'Already part of the club?' : 'New around here?'}</span>
        <button type="button" onClick={() => { setMode(registering ? 'login' : 'register'); setError(''); setNotice(''); }}>
          {registering ? 'Sign in' : 'Create an account'}
        </button>
      </div>
      <span className="form-secure"><LockKeyhole size={13} /> YOUR DETAILS STAY YOURS</span>
    </form>
  );
}

function VehicleEditor({ value, setValue, busy, onSubmit, onClose }) {
  function update(field, next) {
    setValue((current) => ({ ...current, [field]: next }));
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="vehicle-editor" onSubmit={onSubmit}>
        <div className="editor-header">
          <div className="account-icon"><CarFront size={20} /></div>
          <button className="icon-button" type="button" aria-label="Close form" onClick={onClose}><X size={19} /></button>
        </div>
        <p className="eyebrow"><span className="eyebrow-line" /> THE NORTHLINE COLLECTION</p>
        <h3>{value.vehicle ? 'Refine the details.' : 'A new arrival.'}</h3>
        <p className="editor-description">Thoughtful details make for better drives.</p>
        <div className="editor-grid">
          <label className="form-label">MAKE<input required maxLength="60" value={value.make} onChange={(event) => update('make', event.target.value)} placeholder="Volvo" /></label>
          <label className="form-label">MODEL<input required maxLength="60" value={value.model} onChange={(event) => update('model', event.target.value)} placeholder="XC60" /></label>
          <label className="form-label">CATEGORY<select value={value.category} onChange={(event) => update('category', event.target.value)}>{CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="form-label">PRICE (USD)<input required type="number" min="0.01" step="0.01" value={value.price} onChange={(event) => update('price', event.target.value)} placeholder="42000" /></label>
          <label className="form-label form-label-full">UNITS IN STOCK<input required type="number" min="0" step="1" value={value.quantity} onChange={(event) => update('quantity', event.target.value)} /></label>
        </div>
        <button className="auth-submit" disabled={busy} type="submit">{busy ? 'Saving…' : value.vehicle ? 'Save changes' : 'Add to the collection'} <ArrowUpRight size={16} /></button>
      </form>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>,
);

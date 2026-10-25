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
  Sparkles,
  ShieldCheck,
  SlidersHorizontal,
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
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
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
      return result.vehicle;
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.status === 401) signOut();
      return null;
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
            bodyType: editor.bodyType.trim() || null,
            year: editor.year ? Number(editor.year) : null,
            fuelType: editor.fuelType || null,
            transmission: editor.transmission || null,
            seatingCapacity: editor.seatingCapacity ? Number(editor.seatingCapacity) : null,
            mileageKmpl: editor.mileageKmpl ? Number(editor.mileageKmpl) : null,
            electricRangeKm: editor.electricRangeKm ? Number(editor.electricRangeKm) : null,
            engineCapacityCc: editor.engineCapacityCc ? Number(editor.engineCapacityCc) : null,
            groundClearanceMm: editor.groundClearanceMm ? Number(editor.groundClearanceMm) : null,
            safetyFeatures: editor.safetyFeatures.trim() || null,
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
          <a className="nav-link" href="#ai-finder">AI car finder</a>
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
              <a className="hero-link" href="#ai-finder">Find a car for me <Sparkles size={15} /></a>
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

        <AICarFinder
          session={session}
          onPurchase={handlePurchase}
          onUnauthorized={signOut}
        />

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
                  <button className="add-vehicle" type="button" onClick={() => setEditor({
                    make: '', model: '', category: 'SUV', price: '', quantity: '1',
                    bodyType: '', year: '', fuelType: '', transmission: '', seatingCapacity: '',
                    mileageKmpl: '', electricRangeKm: '', engineCapacityCc: '',
                    groundClearanceMm: '', safetyFeatures: '',
                  })}>
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
                        bodyType: vehicle.bodyType || '',
                        year: vehicle.year ? String(vehicle.year) : '',
                        fuelType: vehicle.fuelType || '',
                        transmission: vehicle.transmission || '',
                        seatingCapacity: vehicle.seatingCapacity ? String(vehicle.seatingCapacity) : '',
                        mileageKmpl: vehicle.mileageKmpl ? String(vehicle.mileageKmpl) : '',
                        electricRangeKm: vehicle.electricRangeKm ? String(vehicle.electricRangeKm) : '',
                        engineCapacityCc: vehicle.engineCapacityCc ? String(vehicle.engineCapacityCc) : '',
                        groundClearanceMm: vehicle.groundClearanceMm ? String(vehicle.groundClearanceMm) : '',
                        safetyFeatures: vehicle.safetyFeatures || '',
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

function AICarFinder({ session, onPurchase, onUnauthorized }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [details, setDetails] = useState(null);

  const suggestions = [
    'Family SUV under ₹20 lakh with at least five seats',
    'Automatic car for city driving under ₹15 lakh',
    'Electric car with a long driving range',
    'Fuel-efficient petrol car under ₹10 lakh',
  ];

  async function submit(nextQuery = query) {
    const cleanQuery = nextQuery.trim();
    if (!session) {
      setError('Sign in to search the live vehicle inventory.');
      return;
    }
    if (cleanQuery.length < 3 || cleanQuery.length > 2000) {
      setError('Enter a request between 3 and 2,000 characters.');
      return;
    }
    setQuery(cleanQuery);
    setLoading(true);
    setError('');
    setComparison(null);
    setSelectedIds([]);
    try {
      const response = await fetch('/api/ai/car-finder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ query: cleanQuery }),
      });
      const body = await response.json();
      if (!response.ok) {
        const failure = new Error(body.error || 'Car Finder could not complete this search.');
        failure.status = response.status;
        throw failure;
      }
      setResult(body);
    } catch (failure) {
      setError(failure.message || 'Network error while searching the vehicle inventory.');
      if (failure.status === 401) onUnauthorized();
    } finally {
      setLoading(false);
    }
  }

  function toggleSelection(id) {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((selected) => selected !== id);
      if (current.length >= 3) return current;
      return [...current, id];
    });
  }

  async function purchaseRecommendation(vehicle) {
    const updated = await onPurchase(vehicle);
    if (!updated) return;
    const updateRecommendations = (items) => items.map((item) => item.vehicle.id === updated.id
      ? { ...item, vehicle: { ...item.vehicle, quantity: updated.quantity } }
      : item);
    setResult((current) => current && ({
      ...current,
      matches: updateRecommendations(current.matches),
      alternatives: updateRecommendations(current.alternatives),
    }));
    setDetails((current) => current?.vehicle.id === updated.id ? null : current);
  }

  async function compareSelected() {
    if (!selectedIds.length) return;
    setComparing(true);
    setError('');
    try {
      const response = await fetch('/api/ai/car-finder/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ vehicle_ids: selectedIds, original_query: query }),
      });
      const body = await response.json();
      if (!response.ok) {
        const failure = new Error(body.error || 'The selected vehicles could not be compared.');
        failure.status = response.status;
        throw failure;
      }
      setComparison(body);
    } catch (failure) {
      setError(failure.message || 'Network error while comparing vehicles.');
      if (failure.status === 401) onUnauthorized();
    } finally {
      setComparing(false);
    }
  }

  function clearSearch() {
    setQuery('');
    setResult(null);
    setError('');
    setComparison(null);
    setSelectedIds([]);
  }

  function recommendationCard(item) {
    const vehicle = item.vehicle;
    const specs = vehicle.specifications || {};
    const isSelected = selectedIds.includes(vehicle.id);
    return (
      <article className="finder-card" key={vehicle.id}>
        <div className="finder-card-top">
          <span className={`finder-match-label ${item.isExactMatch ? 'is-exact' : 'is-alternative'}`}>
            {item.isExactMatch ? 'MEETS YOUR FILTERS' : `ALTERNATIVE · RELAXED ${item.relaxedConstraint}`}
          </span>
          <label className="compare-select">
            <input
              type="checkbox"
              checked={isSelected}
              disabled={!isSelected && selectedIds.length >= 3}
              onChange={() => toggleSelection(vehicle.id)}
              aria-label={`Select ${vehicle.make} ${vehicle.model} for comparison`}
            />
            Compare
          </label>
        </div>
        <p className="finder-card-make">{vehicle.make} · {vehicle.category}</p>
        <h3>{vehicle.model}</h3>
        <p className="finder-price">{money(vehicle.price)}</p>
        <p className="finder-stock">
          {vehicle.quantity > 0 ? `${vehicle.quantity} in stock` : 'Out of stock'}
          {specs.seatingCapacity ? ` · ${specs.seatingCapacity} seats` : ''}
          {specs.fuelType ? ` · ${specs.fuelType}` : ''}
          {specs.transmission ? ` · ${specs.transmission}` : ''}
        </p>
        <p className="finder-reason">{item.reasons?.length
          ? item.reasons.join(' ')
          : 'Matches the stated vehicle requirements.'}</p>
        {item.tradeOffs?.length > 0 && (
          <ul className="finder-tradeoffs">
            {item.tradeOffs.map((tradeOff) => <li key={tradeOff}>{tradeOff}</li>)}
          </ul>
        )}
        {item.alternativeExplanation && <p className="finder-alternative-copy">{item.alternativeExplanation}</p>}
        <div className="finder-card-actions">
          <button type="button" className="finder-secondary" onClick={() => setDetails(item)}>View details</button>
          <button
            type="button"
            className="purchase-button"
            disabled={vehicle.quantity < 1}
            onClick={() => purchaseRecommendation(vehicle)}
          >
            {vehicle.quantity < 1 ? 'Sold out' : 'Purchase'}
          </button>
        </div>
      </article>
    );
  }

  return (
    <section className="finder-section" id="ai-finder">
      <div className="finder-heading">
        <p className="eyebrow"><span className="eyebrow-line" /> A MORE HUMAN SEARCH</p>
        <h2>AI Car <span>Finder.</span></h2>
        <p>Describe what you need. We’ll search the vehicles and specifications actually in this showroom.</p>
      </div>
      <div className="finder-search">
        <label htmlFor="car-finder-query">WHAT SHOULD YOUR NEXT CAR DO?</label>
        <textarea
          id="car-finder-query"
          rows="3"
          maxLength="2000"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Tell us what kind of car you need, your budget, and what matters most…"
        />
        <div className="finder-submit-row">
          <span>Natural-language parsing uses only your search request—not account or payment details.</span>
          <div>
            {result && <button className="finder-secondary" type="button" onClick={clearSearch}>Clear</button>}
            <button className="finder-submit" type="button" disabled={loading || !session} onClick={() => submit()}>
              {loading ? <><span className="loading-spinner spinner-small" /> Interpreting…</> : <><Sparkles size={15} /> Find my car</>}
            </button>
          </div>
        </div>
      </div>

      {!session && <p className="finder-auth-note">Sign in to search current inventory and compare vehicles.</p>}
      {error && <div className="notice notice-error finder-notice" role="alert">{error}</div>}

      <div className="finder-suggestions" aria-label="Suggested searches">
        <span>TRY A SEARCH</span>
        {suggestions.map((suggestion) => (
          <button key={suggestion} type="button" disabled={!session || loading} onClick={() => submit(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>

      {result && (
        <div className="finder-results" aria-live="polite">
          {result.warning && <div className="finder-provider-warning" role="status">{result.warning}</div>}
          <div className="finder-result-summary">
            <div>
              <p className="eyebrow"><span className="eyebrow-line" /> INTERPRETATION · {result.parser === 'provider' ? 'AI-ASSISTED' : 'BUILT-IN PARSER'}</p>
              <h3>{result.summary}</h3>
            </div>
          </div>
          {result.needsClarification ? (
            <div className="finder-clarification" role="status">{result.clarificationQuestion}</div>
          ) : (
            <>
              {result.criteria?.mustHave?.length > 0 && (
                <div className="finder-criteria">
                  <span>HARD REQUIREMENTS</span>
                  {result.criteria.mustHave.map((criterion) => <span className="finder-criterion" key={criterion}>{criterion}</span>)}
                  {result.criteria.preferences?.map((preference) => (
                    <span className="finder-preference" key={preference}>Priority: {preference.replaceAll('_', ' ')}</span>
                  ))}
                  {result.criteria.excluded?.map((constraint) => <span className="finder-criterion" key={constraint}>{constraint}</span>)}
                </div>
              )}
              {result.matches.length > 0 && (
                <>
                  <div className="finder-results-header">
                    <h3>Exact matches <span>{result.matches.length}</span></h3>
                    <span>Ranked by recorded specifications and your stated priorities.</span>
                  </div>
                  <div className="finder-grid">{result.matches.map(recommendationCard)}</div>
                </>
              )}
              {result.alternatives.length > 0 && (
                <>
                  <div className="finder-results-header alternatives-heading">
                    <h3>No exact match <span>Consider relaxing one filter</span></h3>
                    <span>Each option relaxes only its labeled requirement; other hard constraints stay applied.</span>
                  </div>
                  <div className="finder-grid">{result.alternatives.map(recommendationCard)}</div>
                </>
              )}
              {!result.matches.length && !result.alternatives.length && (
                <div className="finder-clarification" role="status">
                  No available inventory matches these interpreted requirements. Try a different budget, category, or specification.
                </div>
              )}
            </>
          )}

          {(result.matches.length + result.alternatives.length) > 0 && (
            <div className="finder-compare-bar">
              <span>{selectedIds.length} of 3 selected · choose at least 2</span>
              <button type="button" className="finder-submit" disabled={selectedIds.length < 2 || comparing} onClick={compareSelected}>
                {comparing ? 'Comparing…' : 'Compare selected'}
              </button>
            </div>
          )}
        </div>
      )}

      {comparison && (
        <div className="finder-comparison" aria-live="polite">
          <div className="finder-results-header">
            <h3>Side-by-side <span>comparison</span></h3>
            <button className="finder-secondary" type="button" onClick={() => setComparison(null)}>Close comparison</button>
          </div>
          <p className="finder-comparison-summary">{comparison.summary}</p>
          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <thead><tr><th>Specification</th>{comparison.vehicles.map((vehicle) => <th key={vehicle.id}>{vehicle.make} {vehicle.model}</th>)}</tr></thead>
              <tbody>
                {comparison.rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.label}</th>
                    {row.values.map((value, index) => (
                      <td key={`${row.key}-${comparison.vehicles[index].id}`}>
                        {row.key === 'price' ? money(value) : value === null ? 'Not recorded' : String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="comparison-footnote">Only specifications recorded in the current catalogue are compared. No overall winner is assumed.</p>
        </div>
      )}

      {details && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetails(null); }}>
          <div className="finder-details" role="dialog" aria-modal="true" aria-labelledby="finder-details-title">
            <div className="editor-header">
              <p className="eyebrow"><span className="eyebrow-line" /> CURRENT CATALOGUE DATA</p>
              <button className="icon-button" type="button" aria-label="Close vehicle details" onClick={() => setDetails(null)}><X size={19} /></button>
            </div>
            <h3 id="finder-details-title">{details.vehicle.make} {details.vehicle.model}</h3>
            <p className="finder-price">{money(details.vehicle.price)}</p>
            <dl className="finder-spec-list">
              {Object.entries(details.vehicle.specifications || {}).map(([key, value]) => (
                <div key={key}><dt>{key.replace(/([A-Z])/g, ' $1').replaceAll('_', ' ')}</dt><dd>{value === null ? 'Not recorded' : String(value)}</dd></div>
              ))}
            </dl>
            {details.tradeOffs?.map((tradeOff) => <p className="finder-detail-note" key={tradeOff}>{tradeOff}</p>)}
            <button
              className="finder-submit"
              type="button"
              disabled={details.vehicle.quantity < 1}
              onClick={() => purchaseRecommendation(details.vehicle)}
            >
              {details.vehicle.quantity < 1 ? 'Sold out' : 'Purchase'}
            </button>
          </div>
        </div>
      )}
    </section>
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
          <label className="form-label">PRICE (INR)<input required type="number" min="0.01" step="0.01" value={value.price} onChange={(event) => update('price', event.target.value)} placeholder="42000" /></label>
          <label className="form-label form-label-full">UNITS IN STOCK<input required type="number" min="0" step="1" value={value.quantity} onChange={(event) => update('quantity', event.target.value)} /></label>
        </div>
        <details className="vehicle-spec-editor">
          <summary>Vehicle specifications <span>Optional · leave unknown fields blank</span></summary>
          <div className="editor-grid">
            <label className="form-label">BODY TYPE<input maxLength="40" value={value.bodyType} onChange={(event) => update('bodyType', event.target.value)} placeholder="Compact SUV" /></label>
            <label className="form-label">MODEL YEAR<input type="number" min="1886" max="2100" step="1" value={value.year} onChange={(event) => update('year', event.target.value)} placeholder="2024" /></label>
            <label className="form-label">FUEL TYPE<select value={value.fuelType} onChange={(event) => update('fuelType', event.target.value)}><option value="">Not recorded</option>{['petrol', 'diesel', 'electric', 'hybrid', 'cng', 'lpg'].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="form-label">TRANSMISSION<select value={value.transmission} onChange={(event) => update('transmission', event.target.value)}><option value="">Not recorded</option><option value="automatic">Automatic</option><option value="manual">Manual</option></select></label>
            <label className="form-label">SEATING CAPACITY<input type="number" min="1" max="20" step="1" value={value.seatingCapacity} onChange={(event) => update('seatingCapacity', event.target.value)} /></label>
            <label className="form-label">MILEAGE (KM/L)<input type="number" min="0.1" max="200" step="0.1" value={value.mileageKmpl} onChange={(event) => update('mileageKmpl', event.target.value)} /></label>
            <label className="form-label">EV RANGE (KM)<input type="number" min="0.1" max="3000" step="0.1" value={value.electricRangeKm} onChange={(event) => update('electricRangeKm', event.target.value)} /></label>
            <label className="form-label">ENGINE (CC)<input type="number" min="1" max="20000" step="1" value={value.engineCapacityCc} onChange={(event) => update('engineCapacityCc', event.target.value)} /></label>
            <label className="form-label">GROUND CLEARANCE (MM)<input type="number" min="1" max="1000" step="1" value={value.groundClearanceMm} onChange={(event) => update('groundClearanceMm', event.target.value)} /></label>
            <label className="form-label form-label-full">RECORDED SAFETY FEATURES<input maxLength="500" value={value.safetyFeatures} onChange={(event) => update('safetyFeatures', event.target.value)} placeholder="Enter only verified features" /></label>
          </div>
        </details>
        <button className="auth-submit" disabled={busy} type="submit">{busy ? 'Saving…' : value.vehicle ? 'Save changes' : 'Add to the collection'} <ArrowUpRight size={16} /></button>
      </form>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>,
);

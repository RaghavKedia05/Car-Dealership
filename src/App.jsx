import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CarFront, Check, ChevronDown, CircleHelp, Database, LockKeyhole, Minus, Plus, Search, Sparkles, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { PublicHeader } from './components/PublicHeader.jsx';
import { GlobalErrorToast } from './components/GlobalErrorToast.jsx';
import { PublicLanding } from './features/public/PublicLanding.jsx';
import { PublicVehiclePage } from './features/public/PublicVehiclePage.jsx';
import { ContactPage } from './features/public/ContactPage.jsx';
import { AdminDashboard } from './features/admin/AdminDashboard.jsx';
import { AICarFinder } from './features/ai-car-finder/AICarFinder.jsx';
import { VehicleCard } from './features/inventory/VehicleCard.jsx';
import { VehicleEditor } from './features/inventory/VehicleEditor.jsx';
import { VehicleCheckout } from './features/checkout/VehicleCheckout.jsx';
import { CustomerDashboard } from './features/account/CustomerDashboard.jsx';
import { PasswordRecovery } from './features/auth/PasswordRecovery.jsx';
import { PasswordReset } from './features/auth/PasswordReset.jsx';
import { AuthForm } from './features/auth/AuthForm.jsx';
import { apiUrl, reportError, parseApiResponse } from './lib/api-client.js';
import { getStoredSession } from './lib/auth-session.js';
import { CATEGORIES } from './lib/vehicle-categories.js';

export function App() {
  const [session, setSession] = useState(getStoredSession);
  const [location, setLocation] = useState(() => ({
    pathname: window.location.pathname,
    search: window.location.search,
  }));
  const { pathname, search } = location;
  const [authMode, setAuthMode] = useState('login');
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [toastError, setToastError] = useState(null);
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
  const [checkoutVehicle, setCheckoutVehicle] = useState(null);
  const checkoutResolver = useRef(null);
  const [mobileFilters, setMobileFilters] = useState(false);
  const isAdmin = session?.user.role === 'admin';

  function handleAccountUpdated(user) {
    if (!session) return;
    const currentUser = session.user;
    if (['name', 'email', 'phone', 'deliveryAddress', 'role'].every((key) => currentUser[key] === user[key])) return;
    localStorage.setItem('northline-user', JSON.stringify(user));
    setSession({ ...session, user });
  }

  function handlePasswordChanged(nextSession) {
    localStorage.setItem('northline-token', nextSession.token);
    localStorage.setItem('northline-user', JSON.stringify(nextSession.user));
    setSession(nextSession);
  }

  useEffect(() => {
    function handleAppError(event) {
      setToastError({ message: event.detail, id: performance.now() });
    }
    window.addEventListener('app-error', handleAppError);
    return () => window.removeEventListener('app-error', handleAppError);
  }, []);

  useEffect(() => {
    if (!toastError) return undefined;
    const timeout = window.setTimeout(() => setToastError(null), 7000);
    return () => window.clearTimeout(timeout);
  }, [toastError]);

  useEffect(() => {
    if (error) reportError(new Error(error));
  }, [error]);

  const navigate = useCallback((path) => {
    const target = new URL(path, window.location.origin);
    const targetUrl = `${target.pathname}${target.search}${target.hash}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== targetUrl) {
      window.history.pushState({}, '', targetUrl);
    }
    setLocation({ pathname: target.pathname, search: target.search });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    function handlePopState() {
      setLocation({ pathname: window.location.pathname, search: window.location.search });
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);


  const api = useCallback(async (url, options = {}) => {
    const response = await fetch(apiUrl(url), {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
        ...options.headers,
      },
    }).catch((requestError) => {
      reportError(requestError);
      throw requestError;
    });
    return parseApiResponse(response, 'Something went wrong. Please try again.');
  }, [session]);

  useEffect(() => {
    if (!session) return undefined;
    let active = true;
    fetch(apiUrl('/api/auth/me'), { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error('The saved session is no longer valid');
        return response.json();
      })
      .then(({ user }) => {
        if (active) {
          localStorage.setItem('northline-user', JSON.stringify(user));
          setSession((current) => current ? { ...current, user } : current);
        }
      })
      .catch((requestError) => {
        if (active) {
          console.warn('The saved account session could not be verified:', requestError);
          localStorage.removeItem('northline-token');
          localStorage.removeItem('northline-user');
          setSession(null);
        }
      });
    return () => { active = false; };
  }, [session?.token]);

  useEffect(() => {
    const vehicleDetailRoute = pathname.startsWith('/vehicles/');
    if (pathname === '/admin/inventory' && !session) {
      navigate('/login');
      return;
    }
    if (pathname === '/account' && !session) {
      navigate('/login');
      return;
    }
    if (pathname === '/account' && isAdmin) {
      navigate('/admin/dashboard');
      return;
    }
    if ((['/vehicles', '/showroom'].includes(pathname) || vehicleDetailRoute) && isAdmin) {
      navigate('/admin/dashboard');
      return;
    }
    if (pathname === '/vehicles') {
      navigate('/showroom');
      return;
    }
    if (pathname === '/login' && session) {
      navigate(isAdmin ? '/admin/dashboard' : '/showroom');
      return;
    }
    if (['/admin/dashboard', '/admin/inventory'].includes(pathname) && !session) {
      navigate('/login');
      return;
    }
    if (['/admin/dashboard', '/admin/inventory'].includes(pathname) && session && !isAdmin) {
      navigate('/showroom');
      return;
    }
    if (pathname === '/showroom' && isAdmin) {
      navigate('/admin/dashboard');
    }
  }, [pathname, session, isAdmin, navigate]);

  useEffect(() => {
    if (!['/showroom', '/admin/inventory'].includes(pathname) || (pathname === '/admin/inventory' && !isAdmin)) return undefined;
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
    const endpoint = session ? `/api/vehicles/search?${query}` : `/api/public/vehicles?${query}`;
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
  }, [session, pathname, make, model, category, minPrice, maxPrice, page, pagination.pageSize, sortBy, sortOrder, refreshKey]);

  useEffect(() => {
    setPage(1);
  }, [make, model, category, minPrice, maxPrice, sortBy, sortOrder]);

  const saveSession = useCallback((nextSession) => {
    localStorage.setItem('northline-token', nextSession.token);
    localStorage.setItem('northline-user', JSON.stringify(nextSession.user));
    setSession(nextSession);
    setError('');
    setNotice('');
    navigate(nextSession.user.role === 'admin' ? '/admin/dashboard' : '/showroom');
  }, [navigate]);

  const signOut = useCallback(() => {
    if (session) {
      fetch(apiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
        keepalive: true,
      }).catch((requestError) => console.error('Could not revoke the account session:', requestError));
    }
    localStorage.removeItem('northline-token');
    localStorage.removeItem('northline-user');
    setSession(null);
    setVehicles([]);
    setNotice('You have been signed out.');
    navigate('/');
  }, [session, navigate]);

  function handlePurchase(vehicle) {
    if (!session) { navigate('/login'); return Promise.resolve(null); }
    setBusyId(vehicle.id);
    setError('');
    setNotice('');
    setCheckoutVehicle(vehicle);
    return new Promise((resolve) => {
      checkoutResolver.current = resolve;
    });
  }

  function handleCheckoutComplete(result, failure) {
    if (result?.vehicle) {
      setVehicles((current) => current.map((item) => item.id === result.vehicle.id ? result.vehicle : item));
      if (result.order) {
        const reference = result.order.id.slice(0, 8).toUpperCase();
        setNotice(`Order request received for ${result.vehicle.make} ${result.vehicle.model}. Payment is pending dealership confirmation. Reference: ${reference}.`);
        setRefreshKey((current) => current + 1);
        setBusyId(null);
        checkoutResolver.current?.(result.vehicle);
        checkoutResolver.current = null;
        return;
      }
    }
    if (failure) setNotice(failure);
    setRefreshKey((current) => current + 1);
    setCheckoutVehicle(null);
    setBusyId(null);
    checkoutResolver.current?.(result?.vehicle || null);
    checkoutResolver.current = null;
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
            variant: editor.variant.trim() || null,
            description: editor.description.trim() || null,
            imageUrl: editor.imageUrl.trim() || null,
            status: editor.status,
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
  const vehicleRoute = pathname.match(/^\/vehicles\/([0-9a-f-]+)$/i);
  const customerRoute = pathname === '/showroom' || pathname === '/account' || pathname === '/vehicles' || Boolean(vehicleRoute);
  const adminRoute = pathname === '/admin/dashboard' || pathname === '/admin/inventory';
  const awaitingRoleRedirect = (customerRoute && isAdmin) || (pathname === '/account' && !session)
    || (adminRoute && (!session || !isAdmin))
    || (pathname === '/login' && Boolean(session));

  if (awaitingRoleRedirect) {
    return <div className="public-app"><main className="public-main route-transition" role="status">Opening your secure dealership view…</main></div>;
  }

  if (pathname === '/' || pathname === '/login' || pathname === '/contact' || pathname === '/account'
    || pathname === '/forgot-password' || pathname === '/reset-password' || vehicleRoute
    || pathname === '/admin/dashboard') {
    let pageContent;
    if (pathname === '/') {
      pageContent = <PublicLanding api={api} navigate={navigate} isAdmin={isAdmin} session={session} />;
    } else if (pathname === '/login') {
      pageContent = (
        <section className="public-auth-page stitch-auth-layout">
          <div className="stitch-auth-intro">
            <p className="eyebrow"><span className="eyebrow-line" /> APEX AUTO · PRECISION, IN FOCUS</p>
            <h1>Every great drive<br />starts with <span>the right key.</span></h1>
            <p>Sign in to request a vehicle, manage your orders, and keep your details up to date.</p>
            <ul className="stitch-auth-benefits">
              <li><ShieldCheck size={17} /> Secure account access</li>
              <li><Database size={17} /> Live inventory from the dealership</li>
              <li><Sparkles size={17} /> A smarter way to find your next car</li>
            </ul>
          </div>
          <AuthForm
            mode={authMode}
            setMode={setAuthMode}
            navigate={navigate}
            onAuthenticated={saveSession}
            setError={setError}
            error={error}
            notice={notice}
            setNotice={setNotice}
          />
        </section>
      );
    } else if (pathname === '/account') {
      pageContent = (
        <CustomerDashboard
          api={api}
          user={session.user}
          onUserUpdated={handleAccountUpdated}
          onPasswordChanged={handlePasswordChanged}
          navigate={navigate}
        />
      );
    } else if (pathname === '/forgot-password') {
      pageContent = <PasswordRecovery api={api} navigate={navigate} email={new URLSearchParams(search).get('email') || ''} />;
    } else if (pathname === '/reset-password') {
      pageContent = <PasswordReset api={api} navigate={navigate} token={new URLSearchParams(search).get('token') || ''} />;
    } else if (pathname === '/contact') {
      pageContent = <ContactPage api={api} vehicleId={new URLSearchParams(search).get('vehicle')} session={session} />;
    } else if (vehicleRoute) {
      pageContent = <PublicVehiclePage api={api} vehicleId={vehicleRoute[1]} navigate={navigate} />;
    } else {
      pageContent = (
        <AdminDashboard
          api={api}
          onUnauthorized={signOut}
          navigate={navigate}
          onInventory={() => navigate('/admin/inventory')}
        />
      );
    }

    return (
      <div className="public-app">
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <PublicHeader session={session} isAdmin={isAdmin} signOut={signOut} navigate={navigate} pathname={pathname} />
        <main
          id="main-content"
          className={`public-main ${pathname === '/' ? 'public-home-main' : ''}`}
          tabIndex="-1"
        >
          {pageContent}
        </main>
        <GlobalErrorToast notification={toastError} onDismiss={() => setToastError(null)} />
        {pathname === '/' ? (
          <footer className="public-footer landing-footer">
            <a className="landing-footer-brand" href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }}>
              <span>APEX AUTO</span>
              <small>FIND YOUR NEXT DRIVE</small>
            </a>
            <nav aria-label="Footer navigation">
              <a href="/showroom" onClick={(event) => {
                event.preventDefault();
                navigate(isAdmin ? '/admin/inventory' : '/showroom');
              }}>Showroom</a>
              <a href="/contact" onClick={(event) => { event.preventDefault(); navigate('/contact'); }}>Contact us</a>
            </nav>
            <span>© {new Date().getFullYear()} Apex Auto. All rights reserved.</span>
          </footer>
        ) : (
          <footer className="public-footer">
            <span>Find your next drive with Apex Auto.</span>
            <span>© {new Date().getFullYear()} APEX AUTO</span>
          </footer>
        )}
      </div>
    );
  }

  if (!['/showroom', '/admin/inventory'].includes(pathname)) {
    return (
      <div className="public-app">
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <PublicHeader session={session} isAdmin={isAdmin} signOut={signOut} navigate={navigate} pathname={pathname} />
        <main id="main-content" className="public-main public-not-found" tabIndex="-1">
          <p className="eyebrow"><span className="eyebrow-line" /> PAGE NOT FOUND</p>
          <h1>That road <span>ends here.</span></h1>
          <button className="public-button" type="button" onClick={() => navigate('/')}>Return home <ArrowUpRight size={16} /></button>
        </main>
        <GlobalErrorToast notification={toastError} onDismiss={() => setToastError(null)} />
        <footer className="public-footer"><span>© {new Date().getFullYear()} APEX AUTO</span></footer>
      </div>
    );
  }

  return (
    <div className={`apex-app ${isAdmin ? 'stitch-admin-app' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <PublicHeader session={session} isAdmin={isAdmin} signOut={signOut} navigate={navigate} pathname={pathname} />

      <main className={`apex-main ${isAdmin ? 'stitch-admin-main' : ''}`} id="main-content" tabIndex="-1">
        {isAdmin ? (
          <section className="stitch-inventory-heading">
            <p className="eyebrow"><span className="eyebrow-line" /> DEALERSHIP OPERATIONS · INVENTORY CONTROL</p>
            <h1>Manage the <span>fleet.</span></h1>
            <p>Review live stock, update verified vehicle details, and control listing visibility.</p>
          </section>
        ) : (
          <section className="showroom-intro"><p className="eyebrow">THE APEX AUTO COLLECTION</p><h1>Your next car.<br /><span>Start exploring.</span></h1><p>Compare the details, find your fit, and talk to our team when you are ready.</p>
          </section>
        )}

        <section className="collection-section" id="inventory">
          <div className="section-heading">
            <div>
              <p className="eyebrow"><span className="eyebrow-line" /> FIND YOUR FIT</p>
              <h2>{isAdmin ? <>Vehicle <span>inventory.</span></> : <>Browse the <span>showroom.</span></>}</h2>
            </div>
            {(
              <div className="collection-meta">
                <span className="inventory-count">{loading ? '…' : String(pagination.total).padStart(2, '0')}</span>
                <span>VEHICLES</span>
              </div>
            )}
          </div>

          {(
            <>
              <div className="toolbar">
                <div className={`filters-panel ${mobileFilters ? 'filters-open' : ''}`} id="inventory-filters">
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
                  <div className="price-range" role="group" aria-label="Price range in Indian rupees">
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
                <button className="filter-toggle" type="button" onClick={() => setMobileFilters(!mobileFilters)} aria-expanded={mobileFilters} aria-controls="inventory-filters">
                  <SlidersHorizontal size={17} /> Filters
                </button>
                {isAdmin && (
                  <button className="add-vehicle" type="button" onClick={() => setEditor({
                    make: '', model: '', category: 'SUV', price: '', quantity: '1',
                    bodyType: '', year: '', fuelType: '', transmission: '', seatingCapacity: '',
                    mileageKmpl: '', electricRangeKm: '', engineCapacityCc: '',
                    groundClearanceMm: '', safetyFeatures: '', variant: '', description: '',
                    imageUrl: '', status: 'listed',
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
                <div className="empty-state"><div className="loading-spinner" /><p>Loading vehicles…</p></div>
              ) : vehicles.length ? (
                <div className="vehicle-grid">
                  {vehicles.map((vehicle, index) => (
                    <VehicleCard
                      key={vehicle.id}
                      vehicle={vehicle}
                      index={index}
                      onDetails={() => navigate(`/vehicles/${encodeURIComponent(vehicle.id)}`)}
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
                        variant: vehicle.variant || '',
                        description: vehicle.description || '',
                        imageUrl: vehicle.imageUrl || '',
                        status: vehicle.status || 'listed',
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
              <p className="inventory-note"><LockKeyhole size={13} /> Availability reflects active reservations and confirmed purchases</p>
            </>
          )}
        </section>


        {session && !isAdmin && (
          <AICarFinder
            session={session}
            onPurchase={handlePurchase}
            onUnauthorized={signOut}
          />
        )}
      </main>

      {checkoutVehicle && <VehicleCheckout vehicle={checkoutVehicle} user={session.user} api={api} navigate={navigate} onComplete={handleCheckoutComplete} />}
      <GlobalErrorToast notification={toastError} onDismiss={() => setToastError(null)} />
      <footer className="apex-footer">
        <span>Find your next drive with Apex Auto.</span>
        <span>© {new Date().getFullYear()} APEX AUTO</span>
      </footer>



      {editor && <VehicleEditor value={editor} setValue={setEditor} busy={busyId === 'editor'} onSubmit={saveVehicle} onClose={() => setEditor(null)} />}
    </div>
  );
}

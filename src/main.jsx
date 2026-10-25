import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  ArrowUpRight,
  CarFront,
  Check,
  ChevronDown,
  CircleHelp,
  Database,
  Gauge,
  KeyRound,
  LockKeyhole,
  LogOut,
  Minus,
  Plus,
  Search,
  Share2,
  Sparkles,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  UserRound,
  X,
} from 'lucide-react';
import './styles.css';

const CATEGORIES = ['SUV', 'Sedan', 'Truck', 'Coupe', 'Hatchback', 'Wagon', 'Van', 'Electric', 'Other'];

function reportError(error) {
  const message = error instanceof TypeError
    ? 'Could not connect to the dealership server. Check your internet connection and make sure the API service is running.'
    : error.message || 'Something went wrong. Please try again.';
  window.dispatchEvent(new CustomEvent('app-error', { detail: message }));
}

async function parseApiResponse(response, fallbackMessage) {
  if (response.status === 204) return null;

  const responseText = await response.text();
  let body;
  try {
    body = JSON.parse(responseText);
  } catch {
    const requestError = new Error(
      `The server returned an unexpected response (HTTP ${response.status}) instead of JSON. Check that the API service is running and its /api route is correctly configured.`,
    );
    requestError.status = response.status;
    reportError(requestError);
    throw requestError;
  }

  if (!response.ok) {
    const details = body && Array.isArray(body.details)
      ? body.details.map((detail) => detail.message).filter(Boolean).join('. ')
      : '';
    const requestError = new Error(
      [body?.error || fallbackMessage, details && body?.error === 'Invalid request' ? details : '']
        .filter(Boolean)
        .join(': '),
    );
    requestError.status = response.status;
    reportError(requestError);
    throw requestError;
  }
  return body;
}

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

function useDialogAccessibility(dialogRef, onClose, isOpen = true) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const previouslyFocused = document.activeElement;
    const focusable = () => [...dialog.querySelectorAll(
      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )];
    focusable()[0]?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first || !last) {
        event.preventDefault();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);
}

function App() {
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
  const [mobileFilters, setMobileFilters] = useState(false);
  const [apiStatus, setApiStatus] = useState({ state: 'checking', latency: null });
  const isAdmin = session?.user.role === 'admin';

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

  useEffect(() => {
    let active = true;
    const startedAt = performance.now();
    fetch('/healthz', { cache: 'no-store' })
      .then((response) => parseApiResponse(response, `Health check returned HTTP ${response.status}`))
      .then((body) => {
        if (active) {
          setApiStatus({
            state: body.status === 'ok' ? 'online' : 'error',
            latency: Math.round(performance.now() - startedAt),
          });
        }
      })
      .catch((requestError) => {
        if (active) {
          console.error('Could not verify API and database health:', requestError);
          reportError(requestError);
          setApiStatus({ state: 'error', latency: null });
        }
      });
    return () => { active = false; };
  }, []);

  const api = useCallback(async (url, options = {}) => {
    const response = await fetch(url, {
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
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${session.token}` } })
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
    if ((['/vehicles', '/admin/inventory'].includes(pathname) || vehicleDetailRoute) && !session) {
      navigate('/login');
      return;
    }
    if ((['/vehicles', '/showroom'].includes(pathname) || vehicleDetailRoute) && isAdmin) {
      navigate('/admin/dashboard');
      return;
    }
    if (pathname === '/vehicles' && session) {
      navigate('/showroom');
      return;
    }
    if (pathname === '/login' && session) {
      navigate(isAdmin ? '/admin/dashboard' : '/showroom');
      return;
    }
    if (['/showroom', '/admin/dashboard', '/admin/inventory'].includes(pathname) && !session) {
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
    if (!session || !['/showroom', '/admin/inventory'].includes(pathname)) return undefined;
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
      fetch('/api/auth/logout', {
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
  const customerRoute = pathname === '/showroom' || pathname === '/vehicles' || Boolean(vehicleRoute);
  const adminRoute = pathname === '/admin/dashboard' || pathname === '/admin/inventory';
  const awaitingRoleRedirect = (customerRoute && (!session || isAdmin))
    || (adminRoute && (!session || !isAdmin))
    || (pathname === '/login' && Boolean(session));

  if (awaitingRoleRedirect) {
    return <div className="public-app"><main className="public-main route-transition" role="status">Opening your secure dealership view…</main></div>;
  }

  if (pathname === '/' || pathname === '/login' || pathname === '/contact' || vehicleRoute
    || pathname === '/admin/dashboard') {
    let pageContent;
    if (pathname === '/') {
      pageContent = <PublicLanding navigate={navigate} />;
    } else if (pathname === '/login') {
      pageContent = (
        <section className="public-auth-page">
          <p className="eyebrow"><span className="eyebrow-line" /> ACCOUNT ACCESS</p>
          <h1>Welcome to your <span>showroom.</span></h1>
          <p>Sign in to browse the showroom. Administrators are directed to the dashboard after sign-in.</p>
          <AuthForm
            mode={authMode}
            setMode={setAuthMode}
            onAuthenticated={saveSession}
            setError={setError}
            error={error}
            notice={notice}
            setNotice={setNotice}
          />
        </section>
      );
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
        <PublicHeader session={session} isAdmin={isAdmin} signOut={signOut} navigate={navigate} />
        <main id="main-content" className="public-main" tabIndex="-1">{pageContent}</main>
        <GlobalErrorToast notification={toastError} onDismiss={() => setToastError(null)} />
        <footer className="public-footer">
          <span>VEHICLE DETAILS ARE SHOWN AS RECORDED IN THE CURRENT CATALOGUE.</span>
          <span>© {new Date().getFullYear()} APEX AUTO</span>
        </footer>
      </div>
    );
  }

  if (!['/showroom', '/admin/inventory'].includes(pathname)) {
    return (
      <div className="public-app">
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <PublicHeader session={session} isAdmin={isAdmin} signOut={signOut} navigate={navigate} />
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
    <div className="apex-app">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="apex-header">
        <a className="apex-brand" href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }} aria-label="Apex Auto home">
          <span className="apex-brand-mark"><CarFront size={22} strokeWidth={1.8} /></span>
          <span>APEX AUTO<small>INVENTORY, IN FOCUS</small></span>
        </a>
        <nav className="apex-desktop-nav" aria-label="Showroom">
          <a href="#ai-finder"><Sparkles size={15} /> Finder</a>
          <a href="#inventory"><CarFront size={15} /> Inventory</a>
          <a href="/contact" onClick={(event) => { event.preventDefault(); navigate('/contact'); }}>Contact</a>
        </nav>
        <div className="apex-header-actions">
          <span className={`api-health api-health-${apiStatus.state}`} role="status">
            <span className="health-dot" />
            {apiStatus.state === 'checking' ? 'CHECKING API' : apiStatus.state === 'online' ? 'API & DATABASE ONLINE' : 'API STATUS UNKNOWN'}
          </span>
          {session ? (
            <>
              {isAdmin && <button className="apex-admin-tag" type="button" onClick={() => navigate('/admin/dashboard')}><ShieldCheck size={13} /> Dashboard</button>}
              <span className="apex-user"><UserRound size={15} /> {session.user.name.split(' ')[0]}</span>
              <button className="apex-signout" type="button" onClick={signOut} aria-label="Sign out" title="Sign out">
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <a className="apex-signin" href="/login" onClick={(event) => { event.preventDefault(); navigate('/login'); }}>SIGN IN <ArrowUpRight size={15} /></a>
          )}
        </div>
      </header>

      <main className="apex-main" id="main-content" tabIndex="-1">
        <AICarFinder
          session={session}
          onPurchase={handlePurchase}
          onUnauthorized={signOut}
          apiStatus={apiStatus}
        />

        <section className="collection-section" id="inventory">
          <div className="section-heading">
            <div>
              <p className="eyebrow"><span className="eyebrow-line" /> LIVE DEALERSHIP INVENTORY</p>
              <h2>Browse the <span>showroom.</span></h2>
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

      </main>

      <GlobalErrorToast notification={toastError} onDismiss={() => setToastError(null)} />
      <footer className="apex-footer">
        <span>VEHICLE DETAILS ARE SHOWN AS RECORDED IN THE CURRENT CATALOGUE.</span>
        <span>© {new Date().getFullYear()} APEX AUTO</span>
      </footer>

      <nav className="apex-bottom-nav" aria-label="Showroom navigation">
        <a href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }}><CarFront size={18} /><span>Home</span></a>
        <a href="#ai-finder"><Sparkles size={18} /><span>Finder</span></a>
        <a href="#inventory"><CarFront size={18} /><span>Inventory</span></a>
        {session ? (
          <button type="button" onClick={signOut}><LogOut size={18} /><span>Sign out</span></button>
        ) : (
          <a href="#account"><UserRound size={18} /><span>Account</span></a>
        )}
      </nav>

      {editor && <VehicleEditor value={editor} setValue={setEditor} busy={busyId === 'editor'} onSubmit={saveVehicle} onClose={() => setEditor(null)} />}
    </div>
  );
}

function PublicHeader({ session, isAdmin, signOut, navigate }) {
  function follow(event, path) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(path);
  }

  return (
    <header className="public-header">
      <a className="public-brand" href="/" onClick={(event) => follow(event, '/')} aria-label="Apex Auto home">
        <span className="apex-brand-mark"><CarFront size={22} strokeWidth={1.8} /></span>
        <span>APEX AUTO<small>INVENTORY, IN FOCUS</small></span>
      </a>
      <nav className="public-nav" aria-label="Main navigation">
        <a href="/#top">Home</a>
        <a href="/showroom" onClick={(event) => follow(event, session ? (isAdmin ? '/admin/dashboard' : '/showroom') : '/login')}>Showroom</a>
        <a href="/#about">About</a>
        <a href="/contact" onClick={(event) => follow(event, '/contact')}>Contact</a>
      </nav>
      <div className="public-header-actions">
        {session ? (
          <>
            {isAdmin && <a className="public-admin-link" href="/admin/dashboard" onClick={(event) => follow(event, '/admin/dashboard')}><ShieldCheck size={15} /> Dashboard</a>}
            <span className="apex-user"><UserRound size={15} /> {session.user.name.split(' ')[0]}</span>
            <button className="apex-signout" type="button" onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
          </>
        ) : (
          <>
            <a className="public-admin-login" href="/login" onClick={(event) => follow(event, '/login')}>ADMIN</a>
            <a className="public-signin" href="/login" onClick={(event) => follow(event, '/login')}>SIGN IN <ArrowUpRight size={15} /></a>
          </>
        )}
      </div>
    </header>
  );
}

function PublicLanding({ navigate }) {
  return (
    <>
      <section className="public-hero" id="top">
        <div className="public-hero-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> APEX AUTO · EST. FOR THE ROAD AHEAD</p>
          <h1>Precision crafted<br />automotive <span>excellence.</span></h1>
          <p className="public-lede">A more considered way to find your next car. Explore a carefully maintained collection with clear details and a dealership team ready to help.</p>
          <div className="public-hero-actions">
            <button className="public-button" type="button" onClick={() => navigate('/showroom')}>Enter the showroom <ArrowUpRight size={16} /></button>
            <a className="public-text-link" href="#about">About the dealership</a>
          </div>
          <p className="public-proof"><ShieldCheck size={16} /> A transparent, people-first dealership experience</p>
        </div>
        <div className="public-hero-art" aria-hidden="true">
          <div className="public-hero-orbit" />
          <CarFront size={310} strokeWidth={0.55} />
          <span>PRECISION · CARE · CONFIDENCE</span>
        </div>
      </section>

      <section className="public-about" id="about" aria-labelledby="public-about-title">
        <div className="public-about-heading">
          <p className="eyebrow"><span className="eyebrow-line" /> ABOUT THE DEALERSHIP</p>
          <h2 id="public-about-title">Good cars. Clear answers.<br /><span>A better way forward.</span></h2>
        </div>
        <div className="public-about-copy">
          <p>At Apex Auto, choosing a vehicle should feel informed, personal, and straightforward. We bring our live dealership collection together with thoughtful guidance, so you can focus on finding the right fit.</p>
          <p>Our team keeps listing information grounded in the details available to us, answers your questions directly, and helps you explore the next step at your own pace.</p>
          <button className="public-text-link" type="button" onClick={() => navigate('/contact')}>Talk with our team <ArrowUpRight size={15} /></button>
        </div>
        <div className="public-about-values">
          <article><span className="public-value-icon"><ShieldCheck size={20} /></span><h3>Curated collection</h3><p>Explore vehicles currently listed by the dealership, with availability and specifications shown as recorded.</p></article>
          <article><span className="public-value-icon"><Check size={20} /></span><h3>Clear information</h3><p>Ask questions, review vehicle details, and make decisions with an honest view of what is known.</p></article>
          <article><span className="public-value-icon"><UserRound size={20} /></span><h3>Personal guidance</h3><p>Our enquiry team can help you learn more about a vehicle or begin a conversation about your needs.</p></article>
        </div>
      </section>
      <section className="public-contact-cta">
        <div><p className="eyebrow"><span className="eyebrow-line" /> YOUR NEXT DRIVE STARTS HERE</p><h2>Ready to find your <span>next car?</span></h2><p>Sign in to discover the live showroom, search listings, and use the AI Car Finder.</p></div>
        <button className="public-button" type="button" onClick={() => navigate('/showroom')}>Explore the showroom <ArrowUpRight size={16} /></button>
      </section>
    </>
  );
}

function PublicVehiclePage({ api, vehicleId, navigate }) {
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setVehicle(null);
    setError('');
    setLoading(true);
    api(`/api/public/vehicles/${vehicleId}`)
      .then((result) => { if (active) setVehicle(result.vehicle); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, vehicleId]);

  if (loading) return <div className="empty-state"><div className="loading-spinner" /><p>Loading vehicle details…</p></div>;
  if (error || !vehicle) return <section className="public-not-found"><p className="eyebrow"><span className="eyebrow-line" /> LISTING UNAVAILABLE</p><h1>We couldn’t find <span>that vehicle.</span></h1><p>{error || 'This vehicle may have been removed from the public catalogue.'}</p><button className="public-button" type="button" onClick={() => navigate('/')}>Back to collection <ArrowUpRight size={16} /></button></section>;

  const details = [
    ['Year', vehicle.year], ['Variant', vehicle.variant], ['Category', vehicle.category],
    ['Body type', vehicle.bodyType], ['Fuel', vehicle.fuelType], ['Transmission', vehicle.transmission],
    ['Seats', vehicle.seatingCapacity], ['Mileage', vehicle.mileageKmpl ? `${vehicle.mileageKmpl} km/l` : null],
    ['Electric range', vehicle.electricRangeKm ? `${vehicle.electricRangeKm} km` : null],
    ['Engine', vehicle.engineCapacityCc ? `${vehicle.engineCapacityCc} cc` : null],
    ['Ground clearance', vehicle.groundClearanceMm ? `${vehicle.groundClearanceMm} mm` : null],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');

  return (
    <article className="public-vehicle-detail">
      <button className="public-back-link" type="button" onClick={() => navigate('/')}>← Back to the collection</button>
      <div className="public-detail-layout">
        <div className="public-detail-image">
          {vehicle.imageUrl ? <img src={vehicle.imageUrl} alt={`${vehicle.make} ${vehicle.model}`} />
            : <><span className="public-image-orbit" /><CarFront size={190} strokeWidth={0.7} aria-hidden="true" /></>}
        </div>
        <div className="public-detail-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> {vehicle.status === 'listed' ? 'CURRENT LISTING' : 'UNLISTED'}</p>
          <p className="public-detail-make">{[vehicle.year, vehicle.make, vehicle.variant].filter(Boolean).join(' · ')}</p>
          <h1>{vehicle.model}</h1>
          <p className="public-detail-price">{money(vehicle.price)}</p>
          <p className="public-detail-stock">{vehicle.quantity > 0 ? `${vehicle.quantity} currently in stock` : 'Currently out of stock'}</p>
          {vehicle.description && <p className="public-detail-description">{vehicle.description}</p>}
          <button className="public-button" type="button" onClick={() => navigate(`/contact?vehicle=${encodeURIComponent(vehicle.id)}`)}>Enquire about this vehicle <ArrowUpRight size={16} /></button>
          <p className="public-detail-disclaimer">Availability and specifications reflect the catalogue and may change. Confirm details with the dealership.</p>
        </div>
      </div>
      {details.length > 0 && <section className="public-specifications"><h2>Recorded specifications</h2><dl>{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>}
      {vehicle.safetyFeatures && <p className="public-safety-note"><strong>Safety features:</strong> {vehicle.safetyFeatures}</p>}
    </article>
  );
}

function ContactPage({ api, vehicleId: initialVehicleId, session }) {
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

function AdminDashboard({ api, onUnauthorized, onInventory }) {
  const [dashboard, setDashboard] = useState(null);
  const [enquiries, setEnquiries] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0, total: 0 });
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(pagination.page), pageSize: '10' });
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    setLoading(true);
    setError('');
    Promise.all([api('/api/admin/dashboard'), api(`/api/admin/enquiries?${params}`)])
      .then(([summary, result]) => {
        if (active) {
          setDashboard(summary);
          setEnquiries(result.enquiries);
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

  function applySearch(event) {
    event.preventDefault();
    setPagination((current) => ({ ...current, page: 1 }));
    setSearch(searchInput.trim());
  }

  return (
    <section className="admin-dashboard">
      <div className="admin-page-heading">
        <div><p className="eyebrow"><span className="eyebrow-line" /> DEALERSHIP OPERATIONS</p><h1>Admin <span>dashboard.</span></h1><p>Live figures and customer enquiries from your dealership database.</p></div>
        <button className="public-button" type="button" onClick={onInventory}>Manage inventory <CarFront size={16} /></button>
      </div>
      {error && <div className="notice notice-error" role="alert">{error}<button type="button" onClick={() => setReload((current) => current + 1)}>Retry</button></div>}
      {loading && !dashboard ? <div className="empty-state"><div className="loading-spinner" /><p>Loading dealership data…</p></div> : dashboard && (
        <>
          <div className="admin-metric-grid">
            <AdminMetric title="Vehicles in inventory" value={dashboard.inventory.totalVehicles} detail={`${dashboard.inventory.availableVehicles} listed with stock`} />
            <AdminMetric title="Inventory value" value={money(dashboard.inventory.inventoryValue)} detail="Current listed stock" />
            <AdminMetric title="Enquiries" value={dashboard.enquiries.total} detail={`${dashboard.enquiries.pending} new`} />
            <AdminMetric title="Sold out" value={dashboard.inventory.soldVehicles} detail="Listed, currently out of stock" />
          </div>
          <div className="admin-data-grid">
            <section className="admin-panel"><div className="admin-panel-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> INVENTORY SNAPSHOT</p><h2>What’s in the <span>collection.</span></h2></div></div>
              <AdminBreakdown title="By make" groups={dashboard.groups.make} />
              <AdminBreakdown title="By body type" groups={dashboard.groups.bodyType} />
              <AdminBreakdown title="By fuel" groups={dashboard.groups.fuelType} />
            </section>
            <section className="admin-panel"><div className="admin-panel-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> RECENT STOCK CHANGES</p><h2>Recently <span>updated.</span></h2></div></div>
              {dashboard.recentVehicles.length ? (
                <ul className="admin-recent-list">
                  {dashboard.recentVehicles.map((vehicle) => (
                    <li key={vehicle.id}>
                      <div><strong>{vehicle.make} {vehicle.model}</strong><span>{vehicle.status} · {vehicle.quantity} in stock</span></div>
                      <strong>{money(vehicle.price)}</strong>
                    </li>
                  ))}
                </ul>
              ) : <p className="admin-empty">No vehicle listings have been added yet.</p>}
            </section>
          </div>
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
    </section>
  );
}

function AdminMetric({ title, value, detail }) {
  return <article className="admin-metric"><span>{title}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function AdminBreakdown({ title, groups }) {
  const maximum = Math.max(1, ...groups.map((group) => group.count));
  return <div className="admin-breakdown"><h3>{title}</h3>{groups.length ? groups.map((group) => <div className="admin-bar-row" key={group.label}><span>{group.label}</span><div className="admin-bar-track"><span style={{ width: `${Math.max(5, (group.count / maximum) * 100)}%` }} /></div><strong>{group.count}</strong></div>) : <p className="admin-empty">No data recorded.</p>}</div>;
}

function AICarFinder({ session, onPurchase, onUnauthorized, apiStatus }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [details, setDetails] = useState(null);
  const [searchRequest, setSearchRequest] = useState(null);
  const [compareRequest, setCompareRequest] = useState(null);
  const [shareNotice, setShareNotice] = useState('');
  const detailsDialogRef = useRef(null);
  useDialogAccessibility(detailsDialogRef, () => setDetails(null), Boolean(details));

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
      reportError(new Error('Sign in to search the live vehicle inventory.'));
      return;
    }
    if (cleanQuery.length < 3 || cleanQuery.length > 2000) {
      setError('Enter a request between 3 and 2,000 characters.');
      reportError(new Error('Enter a request between 3 and 2,000 characters.'));
      return;
    }
    setQuery(cleanQuery);
    setLoading(true);
    setError('');
    setShareNotice('');
    setComparison(null);
    setSelectedIds([]);
    const startedAt = performance.now();
    try {
      const response = await fetch('/api/ai/car-finder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ query: cleanQuery }),
      });
      setSearchRequest({ status: response.status, latency: Math.round(performance.now() - startedAt) });
      const body = await parseApiResponse(response, 'Car Finder could not complete this search.');
      setResult(body);
    } catch (failure) {
      if (failure.status === undefined) {
        setSearchRequest({ status: 'network-error', latency: Math.round(performance.now() - startedAt) });
        reportError(failure);
      }
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
    if (selectedIds.length < 2) return;
    setComparing(true);
    setError('');
    const startedAt = performance.now();
    try {
      const response = await fetch('/api/ai/car-finder/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ vehicle_ids: selectedIds, original_query: query }),
      });
      setCompareRequest({ status: response.status, latency: Math.round(performance.now() - startedAt) });
      const body = await parseApiResponse(response, 'The selected vehicles could not be compared.');
      setComparison(body);
      window.requestAnimationFrame(() => {
        document.getElementById('comparison')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (failure) {
      if (failure.status === undefined) {
        setCompareRequest({ status: 'network-error', latency: Math.round(performance.now() - startedAt) });
        reportError(failure);
      }
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

  async function shareVehicle(vehicle) {
    const title = `${vehicle.make} ${vehicle.model}`;
    const text = `${title} · ${money(vehicle.price)} · ${vehicle.quantity} in stock`;
    setShareNotice('');
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: `${window.location.origin}/#inventory` });
        setShareNotice(`${title} shared.`);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${text} — ${window.location.origin}/#inventory`);
        setError('');
        setShareNotice('Vehicle details copied to the clipboard.');
      } else {
        setError('Sharing is not available in this browser.');
        reportError(new Error('Sharing is not available in this browser.'));
      }
    } catch (shareError) {
      if (shareError.name !== 'AbortError') {
        setShareNotice('');
        setError('Could not share this vehicle. Please try again.');
        reportError(new Error('Could not share this vehicle. Please try again.'));
      }
    }
  }

  const selectedVehicles = result
    ? [...result.matches, ...result.alternatives]
      .filter((item) => selectedIds.includes(item.vehicle.id))
      .map((item) => `${item.vehicle.make} ${item.vehicle.model}`)
    : [];

  function requestLabel(request) {
    if (!request) return 'NOT CALLED';
    if (request.status === 'network-error') return 'NETWORK ERROR';
    return `HTTP ${request.status} · ${request.latency} MS`;
  }

  function recommendationCard(item) {
    const vehicle = item.vehicle;
    const specs = vehicle.specifications || {};
    const isSelected = selectedIds.includes(vehicle.id);
    return (
      <article className="finder-card" key={vehicle.id}>
        <div className="vehicle-art">
          <div className="vehicle-art-grid" />
          <span className={`finder-match-label ${item.isExactMatch ? 'is-exact' : 'is-alternative'}`}>
            {item.isExactMatch ? 'EXACT MATCH' : `ALTERNATIVE · RELAXED ${item.relaxedConstraint}`}
          </span>
          <CarFront size={80} strokeWidth={0.9} aria-hidden="true" />
          <span className={`vehicle-stock-indicator ${vehicle.quantity < 1 ? 'is-sold-out' : ''}`}>
            <span />{vehicle.quantity > 0 ? `${vehicle.quantity} IN STOCK` : 'OUT OF STOCK'}
          </span>
        </div>
        <div className="finder-card-content">
          <div className="finder-card-title">
            <div>
              <p className="finder-card-make">{(vehicle.year || specs.year) ? `${vehicle.year || specs.year} · ` : ''}{vehicle.make} · {vehicle.category}</p>
              <h3>{vehicle.model}</h3>
            </div>
            <p className="finder-price">{money(vehicle.price)}</p>
          </div>
          <div className="finder-card-specs">
            {[
              ['FUEL', specs.fuelType],
              ['TRANSMISSION', specs.transmission],
              ['SEATS', specs.seatingCapacity],
              ['MILEAGE', specs.mileageKmpl ? `${specs.mileageKmpl} km/l` : null],
              ['RANGE', specs.electricRangeKm ? `${specs.electricRangeKm} km` : null],
              ['ENGINE', specs.engineCapacityCc ? `${specs.engineCapacityCc} cc` : null],
            ].map(([label, value]) => (
              <div key={label}><span>{label}</span><strong>{value ?? 'Not recorded'}</strong></div>
            ))}
          </div>
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
          <button type="button" className="finder-share" onClick={() => shareVehicle(vehicle)} aria-label={`Share ${vehicle.make} ${vehicle.model}`}>
            <Share2 size={16} />
          </button>
          <button
            type="button"
            className="purchase-button"
            disabled={vehicle.quantity < 1}
            onClick={() => purchaseRecommendation(vehicle)}
          >
            {vehicle.quantity < 1 ? 'Sold out' : 'Purchase'}
          </button>
        </div>
        <label className="compare-select">
          <input
            type="checkbox"
            checked={isSelected}
            disabled={!isSelected && selectedIds.length >= 3}
            onChange={() => toggleSelection(vehicle.id)}
            aria-label={`Select ${vehicle.make} ${vehicle.model} for comparison`}
          />
          Add to comparison
        </label>
        </div>
      </article>
    );
  }

  return (
    <section className="finder-section" id="ai-finder">
      <div className="finder-topline">
        <div className="finder-heading">
          <p className="eyebrow"><span className="eyebrow-line" /> NATURAL LANGUAGE · LIVE INVENTORY</p>
          <h1>Find the car<br />that fits <span>your life.</span></h1>
          <p>Describe what matters. We’ll match your needs against vehicles currently in this showroom.</p>
        </div>
        <div className="finder-live-card" role="status">
          <div className={`finder-live-icon ${apiStatus.state}`}><Database size={19} /></div>
          <div>
            <span>INVENTORY CONNECTION</span>
            <strong>{apiStatus.state === 'online' ? 'Database verified' : apiStatus.state === 'checking' ? 'Checking connection' : 'Connection unavailable'}</strong>
            <small>{apiStatus.state === 'online' && apiStatus.latency !== null
              ? `Health check · ${apiStatus.latency} ms`
              : apiStatus.state === 'checking' ? 'Verifying API and database' : 'Search and inventory may be unavailable'}</small>
          </div>
        </div>
      </div>
      <div className="finder-search">
        <div className="finder-query-heading"><Sparkles size={18} /><label htmlFor="car-finder-query">DESCRIBE YOUR NEXT CAR</label></div>
        <textarea
          id="car-finder-query"
          aria-describedby="finder-query-help"
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
          placeholder="e.g. A spacious automatic SUV for family road trips under ₹20 lakh…"
        />
        <div className="finder-submit-row">
          <span id="finder-query-help"><LockKeyhole size={13} /> {query.length}/2,000 · Your search text only; account and payment details are not used.</span>
          <div>
            {result && <button className="finder-secondary" type="button" onClick={clearSearch}>Clear</button>}
            <button className="finder-submit" type="button" disabled={loading || !session} onClick={() => submit()}>
              {loading ? <><span className="loading-spinner spinner-small" /> Searching…</> : <><Sparkles size={15} /> Find vehicles</>}
            </button>
          </div>
        </div>
      </div>

      {!session && <p className="finder-auth-note">Sign in to search current inventory and compare vehicles.</p>}
      {error && <div className="notice notice-error finder-notice" role="alert">{error}</div>}
      {shareNotice && <p className="share-notice" role="status">{shareNotice}</p>}

      <div className="finder-suggestions" aria-label="Suggested searches">
        <span>QUICK SEARCH</span>
        {suggestions.map((suggestion) => (
          <button key={suggestion} type="button" disabled={!session || loading} onClick={() => submit(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>

      <details className="api-verification">
        <summary><Terminal size={15} /> API &amp; DATA VERIFICATION <ChevronDown size={15} /></summary>
        <div className="verification-grid">
          <div><span><Database size={14} /> API / DATABASE HEALTH</span><strong>{apiStatus.state === 'online' ? `VERIFIED${apiStatus.latency === null ? '' : ` · ${apiStatus.latency} MS`}` : apiStatus.state === 'checking' ? 'CHECKING' : 'UNAVAILABLE'}</strong></div>
          <div><span><Activity size={14} /> INVENTORY SEARCH</span><strong>{requestLabel(searchRequest)}</strong></div>
          <div><span><Activity size={14} /> VEHICLE COMPARISON</span><strong>{requestLabel(compareRequest)}</strong></div>
          <p>Health is verified from the live API. Request timings and HTTP status are measured in this browser; vehicle fields marked “Not recorded” are not present in the catalogue.</p>
        </div>
      </details>

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

        </div>
      )}

      {comparison && (
        <div className="finder-comparison" id="comparison" aria-live="polite">
          <div className="finder-results-header">
            <h3>Side-by-side <span>comparison</span></h3>
            <button className="finder-secondary" type="button" onClick={() => setComparison(null)}>Close comparison</button>
          </div>
          <p className="finder-comparison-summary">{comparison.summary}</p>
          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <thead><tr><th scope="col">Specification</th>{comparison.vehicles.map((vehicle) => <th scope="col" key={vehicle.id}>{vehicle.make} {vehicle.model}</th>)}</tr></thead>
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
          <div className="finder-details" ref={detailsDialogRef} role="dialog" aria-modal="true" aria-labelledby="finder-details-title" tabIndex="-1">
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

      {selectedIds.length > 0 && (
        <div className="compare-dock" role="region" aria-label="Vehicle comparison selection">
          <div className="compare-dock-copy">
            <span>{selectedIds.length}/3 SELECTED</span>
            <strong>{selectedVehicles.join(' · ') || 'Select another vehicle to compare'}</strong>
          </div>
          <button type="button" disabled={selectedIds.length < 2 || comparing} onClick={compareSelected}>
            {comparing ? 'Comparing…' : `Compare ${selectedIds.length} vehicles`}
            <ArrowUpRight size={16} />
          </button>
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
        <span className="vehicle-stock">{vehicle.status === 'unlisted' ? 'UNLISTED' : soldOut ? 'SOLD OUT' : `${String(vehicle.quantity).padStart(2, '0')} AVAILABLE`}</span>
        {vehicle.imageUrl ? <img className="vehicle-photo" src={vehicle.imageUrl} alt={`${vehicle.make} ${vehicle.model}`} loading="lazy" /> : (
          <>
            <div className="vehicle-art-number">0{String(index + 1).slice(-1)}</div>
            <div className="vehicle-art-circle" />
            <CarFront className="vehicle-illustration" strokeWidth={0.85} aria-hidden="true" />
            <span className="vehicle-art-label">APEX AUTO / LIVE LISTING</span>
          </>
        )}
      </div>
      <div className="vehicle-details">
        <div className="vehicle-heading">
          <div>
            <span className="vehicle-make">{[vehicle.year, vehicle.make, vehicle.variant].filter(Boolean).join(' · ')}</span>
            <h3>{vehicle.model}</h3>
          </div>
          <span className="category-pill">{vehicle.category}</span>
        </div>
        <div className="vehicle-spec-row">
          <span><Gauge size={14} /> {vehicle.quantity > 0 ? 'IN STOCK' : 'OUT OF STOCK'}</span>
          <span><CarFront size={14} /> {vehicle.status === 'listed' ? 'LIVE LISTING' : 'HIDDEN LISTING'}</span>
        </div>
        <div className="vehicle-card-footer">
          <div><span className="price-caption">YOUR NEXT CHAPTER FROM</span><span className="vehicle-price">{money(vehicle.price)}</span></div>
          <button
            className={`purchase-button ${soldOut ? 'purchase-disabled' : ''}`}
            type="button"
            disabled={soldOut || busy || vehicle.status === 'unlisted'}
            onClick={() => onPurchase(vehicle)}
          >
            {busy ? <span className="loading-spinner spinner-small" /> : vehicle.status === 'unlisted' ? 'Unlisted' : soldOut ? 'Sold out' : <>Purchase <ArrowUpRight size={15} /></>}
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

function GlobalErrorToast({ notification, onDismiss }) {
  if (!notification) return null;
  return (
    <div className="global-error-toast" role="alert" aria-live="assertive">
      <CircleHelp size={18} />
      <span>{notification.message}</span>
      <button type="button" aria-label="Dismiss error notification" onClick={onDismiss}><X size={16} /></button>
    </div>
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
      const body = await parseApiResponse(response, 'We could not sign you in. Please try again.');
      if (registering) {
        setMode('login');
        setPassword('');
        setError('');
        setNotice('Your account is ready. Sign in to continue.');
        return;
      }
      onAuthenticated({ token: body.token, user: body.user });
    } catch (requestError) {
      reportError(requestError);
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
  const dialogRef = useRef(null);
  useDialogAccessibility(dialogRef, onClose);

  function update(field, next) {
    setValue((current) => ({ ...current, [field]: next }));
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="vehicle-editor" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="vehicle-editor-title" onSubmit={onSubmit} tabIndex="-1">
        <div className="editor-header">
          <div className="account-icon"><CarFront size={20} /></div>
          <button className="icon-button" type="button" aria-label="Close form" onClick={onClose}><X size={19} /></button>
        </div>
        <p className="eyebrow"><span className="eyebrow-line" /> APEX AUTO INVENTORY</p>
        <h3 id="vehicle-editor-title">{value.vehicle ? 'Refine the details.' : 'A new arrival.'}</h3>
        <p className="editor-description">Thoughtful details make for better drives.</p>
        <div className="editor-grid">
          <label className="form-label">MAKE<input required maxLength="60" value={value.make} onChange={(event) => update('make', event.target.value)} placeholder="Volvo" /></label>
          <label className="form-label">MODEL<input required maxLength="60" value={value.model} onChange={(event) => update('model', event.target.value)} placeholder="XC60" /></label>
          <label className="form-label">CATEGORY<select value={value.category} onChange={(event) => update('category', event.target.value)}>{CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="form-label">PRICE (INR)<input required type="number" min="0.01" step="0.01" value={value.price} onChange={(event) => update('price', event.target.value)} placeholder="42000" /></label>
          <label className="form-label form-label-full">UNITS IN STOCK<input required type="number" min="0" step="1" value={value.quantity} onChange={(event) => update('quantity', event.target.value)} /></label>
        </div>
        <details className="vehicle-spec-editor">
          <summary>Specifications and public listing <span>Only enter verified information</span></summary>
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
            <label className="form-label form-label-full">PUBLIC VARIANT<input maxLength="80" value={value.variant} onChange={(event) => update('variant', event.target.value)} placeholder="Inscription AWD" /></label>
            <label className="form-label">LISTING VISIBILITY<select value={value.status} onChange={(event) => update('status', event.target.value)}><option value="listed">Listed publicly</option><option value="unlisted">Hidden from public</option></select></label>
            <label className="form-label form-label-full">IMAGE URL (HTTPS)<input type="url" maxLength="2048" value={value.imageUrl} onChange={(event) => update('imageUrl', event.target.value)} placeholder="https://…" /><span className="field-help">Images must be hosted at a persistent HTTPS URL. Upload/storage is not included.</span></label>
            <label className="form-label form-label-full">PUBLIC DESCRIPTION<textarea maxLength="4000" rows="4" value={value.description} onChange={(event) => update('description', event.target.value)} placeholder="Describe verified vehicle details for prospective customers." /></label>
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

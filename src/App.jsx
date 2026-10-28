import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BadgeCheck, CarFront, Check, CircleAlert, HandCoins, Plus, Search, Sparkles, X } from 'lucide-react';
import { PublicHeader } from './components/PublicHeader.jsx';
import { SiteFooter } from './components/SiteFooter.jsx';
import { GlobalErrorToast } from './components/GlobalErrorToast.jsx';
import { useDialogAccessibility } from './hooks/useDialogAccessibility.js';
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
  const [deleteTarget, setDeleteTarget] = useState(null);
  const deleteDialogRef = useRef(null);
  useDialogAccessibility(deleteDialogRef, () => setDeleteTarget(null), Boolean(deleteTarget));
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

  const navigate = useCallback((path) => {
    const target = new URL(path, window.location.origin);
    const targetUrl = `${target.pathname}${target.search}${target.hash}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== targetUrl) {
      window.history.pushState({}, '', targetUrl);
    }
    setLocation({ pathname: target.pathname, search: target.search });
    if (target.hash) {
      window.setTimeout(() => document.getElementById(target.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
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
    if (['/vehicles', '/admin/inventory'].includes(pathname) && !session) {
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
    if (pathname === '/vehicles' && session) {
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
    if (!['/showroom', '/admin/inventory'].includes(pathname) || (pathname === '/admin/inventory' && !session)) return undefined;
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
    // Visitors browse the public catalogue; signed-in users get the authenticated search.
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
    setNotice('');
    navigate('/');
  }, [session, navigate]);

  function handlePurchase(vehicle) {
    if (!session) {
      navigate('/login');
      return Promise.resolve(null);
    }
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
        setNotice(`${result.vehicle.make} ${result.vehicle.model} reserved — reference #${reference}. Our team will be in touch shortly.`);
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
      setNotice(editing ? `${result.vehicle.make} ${result.vehicle.model} updated.` : `${result.vehicle.make} ${result.vehicle.model} added to inventory.`);
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.status === 401) signOut();
    } finally {
      setBusyId(null);
    }
  }

  async function deleteVehicle(vehicle) {
    setDeleteTarget(null);
    setBusyId(vehicle.id);
    setError('');
    try {
      await api(`/api/vehicles/${vehicle.id}`, { method: 'DELETE' });
      setVehicles((current) => current.filter((item) => item.id !== vehicle.id));
      const remainingPages = Math.ceil((pagination.total - 1) / pagination.pageSize);
      if (page > Math.max(remainingPages, 1)) setPage(Math.max(remainingPages, 1));
      setRefreshKey((current) => current + 1);
      setNotice(`${vehicle.make} ${vehicle.model} removed from inventory.`);
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

  function openNewVehicle() {
    setEditor({
      make: '', model: '', category: 'SUV', price: '', quantity: '1',
      bodyType: '', year: '', fuelType: '', transmission: '', seatingCapacity: '',
      mileageKmpl: '', electricRangeKm: '', engineCapacityCc: '',
      groundClearanceMm: '', safetyFeatures: '', variant: '', description: '',
      imageUrl: '', status: 'listed',
    });
  }

  function openEditVehicle(vehicle) {
    const text = (value) => (value === null || value === undefined ? '' : String(value));
    setEditor({
      vehicle,
      make: vehicle.make,
      model: vehicle.model,
      category: vehicle.category,
      price: String(vehicle.price),
      quantity: String(vehicle.quantity),
      bodyType: text(vehicle.bodyType),
      year: text(vehicle.year),
      fuelType: text(vehicle.fuelType),
      transmission: text(vehicle.transmission),
      seatingCapacity: text(vehicle.seatingCapacity),
      mileageKmpl: text(vehicle.mileageKmpl),
      electricRangeKm: text(vehicle.electricRangeKm),
      engineCapacityCc: text(vehicle.engineCapacityCc),
      groundClearanceMm: text(vehicle.groundClearanceMm),
      safetyFeatures: text(vehicle.safetyFeatures),
      variant: text(vehicle.variant),
      description: text(vehicle.description),
      imageUrl: text(vehicle.imageUrl),
      status: vehicle.status || 'listed',
    });
  }

  const hasFilters = make || model || category || minPrice || maxPrice;
  const searchParams = new URLSearchParams(search);
  const vehicleRoute = pathname.match(/^\/vehicles\/([0-9a-f-]+)$/i);
  const customerRoute = pathname === '/showroom' || pathname === '/account' || pathname === '/vehicles';
  const adminRoute = pathname === '/admin/dashboard' || pathname === '/admin/inventory';
  const awaitingRoleRedirect = (customerRoute && isAdmin)
    || ((pathname === '/account' || pathname === '/vehicles') && !session)
    || (Boolean(vehicleRoute) && isAdmin)
    || (adminRoute && (!session || !isAdmin))
    || (pathname === '/login' && Boolean(session));

  useEffect(() => {
    if (pathname === '/login' && searchParams.get('mode') === 'register') setAuthMode('register');
  }, [pathname, search]);

  const inventoryView = (
    <section className={isAdmin ? '' : 'inventory'} id="inventory" aria-labelledby="inventory-title">
      {!isAdmin && (
        <div className="section-head">
          <div>
            <h2 className="section-title" id="inventory-title">Browse all cars</h2>
            <p>Filter by make, body style, or budget.</p>
          </div>
        </div>
      )}
      <div className="toolbar" role="search">
        <label className="search">
          <Search size={16} />
          <span className="sr-only">Make</span>
          <input className="input" placeholder="Search make, e.g. Hyundai" value={make} onChange={(event) => setMake(event.target.value)} />
        </label>
        <label className="search">
          <CarFront size={16} />
          <span className="sr-only">Model</span>
          <input className="input" placeholder="Model, e.g. Creta" value={model} onChange={(event) => setModel(event.target.value)} />
        </label>
        <label className="sr-only" htmlFor="filter-category">Body style</label>
        <select id="filter-category" className="input" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">All body styles</option>
          {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <div className="price-inputs" role="group" aria-label="Price range in rupees">
          <input className="input" aria-label="Minimum price" inputMode="numeric" placeholder="Min ₹" type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} />
          <span>–</span>
          <input className="input" aria-label="Maximum price" inputMode="numeric" placeholder="Max ₹" type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} />
        </div>
        <label className="sr-only" htmlFor="filter-sort">Sort by</label>
        <select id="filter-sort" className="input" value={`${sortBy}:${sortOrder}`} onChange={(event) => { const [by, order] = event.target.value.split(':'); setSortBy(by); setSortOrder(order); }}>
          <option value="createdAt:desc">Newest first</option>
          <option value="price:asc">Price: low to high</option>
          <option value="price:desc">Price: high to low</option>
          <option value="make:asc">Make: A–Z</option>
          <option value="model:asc">Model: A–Z</option>
        </select>
        {hasFilters && <button className="btn btn-ghost btn-sm" type="button" onClick={clearFilters}><X size={14} /> Clear</button>}
      </div>

      {error && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: 16 }}>
          <CircleAlert size={16} /><span>{error}</span>
          <button type="button" onClick={() => setRefreshKey((current) => current + 1)}>Retry</button>
        </div>
      )}
      {notice && <div className="alert alert-success" role="status" style={{ marginBottom: 16 }}><Check size={16} /><span>{notice}</span><button type="button" aria-label="Dismiss" onClick={() => setNotice('')}><X size={15} /></button></div>}

      {!loading && pagination.total > 0 && <p className="result-count">{pagination.total} {pagination.total === 1 ? 'car' : 'cars'}{hasFilters ? ' match your filters' : isAdmin ? ' in inventory' : ' available to browse'}</p>}

      {loading && !vehicles.length ? (
        <div className="loading-block" role="status"><span className="spinner" /> Loading cars…</div>
      ) : vehicles.length ? (
        <div className="vehicle-grid">
          {vehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              isAdmin={isAdmin}
              busy={busyId === vehicle.id}
              navigate={navigate}
              onPurchase={handlePurchase}
              onEdit={() => openEditVehicle(vehicle)}
              onDelete={(target) => setDeleteTarget(target)}
            />
          ))}
        </div>
      ) : (
        <div className="card empty">
          <div className="empty-icon"><CarFront size={26} /></div>
          <h3>{hasFilters ? 'No cars match your filters' : isAdmin ? 'No vehicles yet' : 'New cars arriving soon'}</h3>
          <p>{hasFilters ? 'Try widening your price range or clearing a filter.' : isAdmin ? 'Add your first vehicle to start selling.' : 'Check back shortly for new arrivals.'}</p>
          {hasFilters && <button className="btn btn-secondary btn-sm" type="button" onClick={clearFilters}>Clear filters</button>}
          {!hasFilters && isAdmin && <button className="btn btn-primary btn-sm" type="button" onClick={openNewVehicle}><Plus size={14} /> Add vehicle</button>}
        </div>
      )}
      {pagination.totalPages > 1 && (
        <nav className="pagination" aria-label="Inventory pages">
          <span>Showing {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}</span>
          <div>
            <button className="btn btn-secondary btn-sm" type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Previous</button>
            <span>Page {pagination.page} of {pagination.totalPages}</span>
            <button className="btn btn-secondary btn-sm" type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((current) => current + 1)}>Next</button>
          </div>
        </nav>
      )}
    </section>
  );

  let pageContent;
  if (awaitingRoleRedirect) {
    pageContent = <div className="loading-block" role="status"><span className="spinner" /> Loading…</div>;
  } else if (pathname === '/') {
    pageContent = <PublicLanding api={api} navigate={navigate} isAdmin={isAdmin} session={session} />;
  } else if (pathname === '/login') {
    pageContent = (
      <section className="auth">
        <div className="auth-aside">
          <h1>Your next car is <span>a few clicks away.</span></h1>
          <p>Sign in to browse our full showroom, use the smart car finder, and reserve a car online — no payment needed.</p>
          <ul className="auth-points">
            <li><Sparkles /> Describe what you need and get instant matches</li>
            <li><BadgeCheck /> Clear prices and full specifications</li>
            <li><HandCoins /> Free 24-hour reservation, pay at the dealership</li>
          </ul>
        </div>
        <div className="auth-main">
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
        </div>
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
    pageContent = <PasswordRecovery api={api} navigate={navigate} email={searchParams.get('email') || ''} />;
  } else if (pathname === '/reset-password') {
    pageContent = <PasswordReset api={api} navigate={navigate} token={searchParams.get('token') || ''} />;
  } else if (pathname === '/contact') {
    pageContent = <ContactPage api={api} vehicleId={searchParams.get('vehicle')} session={session} />;
  } else if (vehicleRoute) {
    pageContent = <PublicVehiclePage api={api} vehicleId={vehicleRoute[1]} navigate={navigate} onPurchase={session && !isAdmin ? handlePurchase : null} />;
  } else if (pathname === '/admin/dashboard') {
    pageContent = <AdminDashboard api={api} onUnauthorized={signOut} navigate={navigate} onInventory={() => navigate('/admin/inventory')} />;
  } else if (pathname === '/admin/inventory') {
    pageContent = (
      <section className="container page">
        <div className="page-head">
          <div>
            <p className="eyebrow">Dealer console</p>
            <h1 className="page-title" id="inventory-title">Inventory</h1>
            <p className="page-lede">Add vehicles, update prices and stock, and control what customers can see.</p>
          </div>
          <button className="btn btn-primary" type="button" onClick={openNewVehicle}><Plus size={16} /> Add vehicle</button>
        </div>
        {inventoryView}
      </section>
    );
  } else if (pathname === '/showroom') {
    pageContent = (
      <div className="container page">
        {session ? (
          <AICarFinder session={session} onPurchase={handlePurchase} onUnauthorized={signOut} />
        ) : (
          <section className="finder">
            <div className="finder-head">
              <div>
                <p className="eyebrow"><Sparkles size={14} /> Smart car finder</p>
                <h1 className="page-title">Find the right car, faster</h1>
                <p>Sign in to describe your ideal car in your own words and get instant matches — or browse every car below.</p>
              </div>
              <div className="cta-band-actions">
                <button className="btn btn-primary" type="button" onClick={() => navigate('/login')}>Sign in</button>
                <button className="btn btn-outline-light" type="button" onClick={() => { setAuthMode('register'); navigate('/login'); }}>Create account</button>
              </div>
            </div>
          </section>
        )}
        {inventoryView}
      </div>
    );
  } else {
    pageContent = (
      <section className="container page">
        <div className="card empty" style={{ padding: '80px 24px' }}>
          <div className="empty-icon"><CarFront size={26} /></div>
          <h3>Page not found</h3>
          <p>The page you’re looking for doesn’t exist or has moved.</p>
          <button className="btn btn-dark" type="button" onClick={() => navigate('/')}>Back to home</button>
        </div>
      </section>
    );
  }

  const isLanding = pathname === '/';
  const showFooter = pathname !== '/login' && !adminRoute;

  return (
    <div className="site">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <PublicHeader session={session} isAdmin={isAdmin} signOut={signOut} navigate={navigate} pathname={pathname} dark={isLanding} />
      <main id="main-content" className="site-main" tabIndex="-1">
        {pageContent}
      </main>
      {showFooter && <SiteFooter navigate={navigate} session={session} isAdmin={isAdmin} />}
      {checkoutVehicle && session && <VehicleCheckout vehicle={checkoutVehicle} user={session.user} api={api} navigate={navigate} onComplete={handleCheckoutComplete} />}
      {editor && <VehicleEditor value={editor} setValue={setEditor} busy={busyId === 'editor'} onSubmit={saveVehicle} onClose={() => setEditor(null)} />}
      {deleteTarget && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }}>
          <div className="modal" style={{ width: 'min(440px, 100%)' }} ref={deleteDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="delete-title" tabIndex="-1">
            <div className="modal-head">
              <div>
                <h2 id="delete-title">Remove {deleteTarget.make} {deleteTarget.model}?</h2>
                <p>This permanently deletes the vehicle from your inventory. To hide it temporarily, edit it and set visibility to Hidden instead.</p>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-secondary" type="button" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" type="button" onClick={() => deleteVehicle(deleteTarget)}>Remove vehicle</button>
            </div>
          </div>
        </div>
      )}
      <GlobalErrorToast notification={toastError} onDismiss={() => setToastError(null)} />
    </div>
  );
}

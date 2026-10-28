import React, { useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, CalendarCheck, HandCoins, MessageSquare, Search, Sparkles } from 'lucide-react';
import { money } from '../../lib/currency-format.js';
import { VehicleImage } from '../../components/VehicleImage.jsx';
import { stockBadge, titleCase } from '../../lib/vehicle-labels.js';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=2000&q=80';

export function PublicLanding({ api, navigate, isAdmin, session }) {
  const [featuredVehicles, setFeaturedVehicles] = useState([]);
  const [total, setTotal] = useState(null);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [featuredError, setFeaturedError] = useState(false);
  const [heroFailed, setHeroFailed] = useState(false);
  const showroomPath = isAdmin ? '/admin/inventory' : session ? '/showroom' : '/login';

  useEffect(() => {
    let active = true;
    setLoadingFeatured(true);
    setFeaturedError(false);
    api('/api/public/vehicles?page=1&pageSize=3&sortBy=createdAt&sortOrder=desc')
      .then((result) => {
        if (!active) return;
        setFeaturedVehicles(result.vehicles);
        setTotal(result.pagination?.total ?? result.vehicles.length);
      })
      .catch(() => { if (active) setFeaturedError(true); })
      .finally(() => { if (active) setLoadingFeatured(false); });
    return () => { active = false; };
  }, [api]);

  function follow(event, path) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(path);
  }

  return (
    <>
      <section className="hero" id="top" aria-labelledby="landing-title">
        {!heroFailed && <img className="hero-image" src={HERO_IMAGE} alt="" aria-hidden="true" fetchPriority="high" referrerPolicy="no-referrer" onError={() => setHeroFailed(true)} />}
        <div className="container hero-content">
          <p className="eyebrow">Apex Auto · India</p>
          <h1 id="landing-title">Find the car that fits <span>your life.</span></h1>
          <p className="hero-lede">Browse our available cars, describe what you need in plain words, and reserve online in minutes — no pressure, no surprises.</p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" type="button" onClick={() => navigate(showroomPath)}>
              {isAdmin ? 'Manage inventory' : 'Browse the showroom'} <ArrowRight size={17} />
            </button>
            <button className="btn btn-outline-light btn-lg" type="button" onClick={() => navigate('/contact')}>
              Talk to our team
            </button>
          </div>
          <div className="hero-stats">
            <div><strong>{total === null ? '—' : total}</strong><span>Cars in the showroom</span></div>
            <div><strong>24 hr</strong><span>Free reservation hold</span></div>
            <div><strong>₹0</strong><span>Paid online to reserve</span></div>
          </div>
        </div>
      </section>

      <section className="section container" id="featured" aria-labelledby="featured-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">Just arrived</p>
            <h2 className="section-title" id="featured-title">Featured cars</h2>
            <p>A few of the latest additions to our showroom.</p>
          </div>
          <a className="btn btn-secondary" href={showroomPath} onClick={(event) => follow(event, showroomPath)}>
            View all cars <ArrowRight size={16} />
          </a>
        </div>
        {loadingFeatured ? (
          <div className="loading-block" role="status"><span className="spinner" /> Loading cars…</div>
        ) : featuredError ? (
          <div className="card empty"><p>Featured cars are unavailable right now. Please try again shortly.</p></div>
        ) : featuredVehicles.length ? (
          <div className="vehicle-grid">
            {featuredVehicles.map((vehicle) => {
              const vehiclePath = `/vehicles/${encodeURIComponent(vehicle.id)}`;
              const badge = stockBadge(vehicle);
              return (
                <article className="vehicle-card" key={vehicle.id}>
                  <a href={vehiclePath} onClick={(event) => follow(event, vehiclePath)} aria-label={`View ${vehicle.make} ${vehicle.model}`}>
                    <VehicleImage vehicle={vehicle}>
                      <span className={badge.tone}>{badge.label}</span>
                      <span className="badge badge-dark vehicle-category">{vehicle.category}</span>
                    </VehicleImage>
                  </a>
                  <div className="vehicle-body">
                    <span className="vehicle-make">{[vehicle.year, vehicle.make].filter(Boolean).join(' · ')}</span>
                    <h3 className="vehicle-title"><a href={vehiclePath} onClick={(event) => follow(event, vehiclePath)}>{vehicle.model}</a></h3>
                    <ul className="spec-list">
                      {[titleCase(vehicle.fuelType), titleCase(vehicle.transmission), vehicle.mileageKmpl ? `${vehicle.mileageKmpl} km/l` : vehicle.electricRangeKm ? `${vehicle.electricRangeKm} km range` : null]
                        .filter(Boolean).map((item) => <li key={item}>{item}</li>)}
                    </ul>
                    <div className="vehicle-foot">
                      <div><span className="price-label">Ex-showroom</span><span className="price">{money(vehicle.price)}</span></div>
                      <a className="btn btn-secondary btn-sm" href={vehiclePath} onClick={(event) => follow(event, vehiclePath)}>Details <ArrowRight size={14} /></a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="card empty"><h3>New cars arriving soon</h3><p>Check back shortly, or tell us what you’re looking for.</p></div>
        )}
      </section>

      <section className="section container" id="about" aria-labelledby="about-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">Why Apex Auto</p>
            <h2 className="section-title" id="about-title">Car buying, made simple</h2>
            <p>Everything you need to choose your next car with confidence — in one place.</p>
          </div>
        </div>
        <div className="feature-grid">
          <article className="card feature">
            <span className="feature-icon"><Sparkles size={22} /></span>
            <h3>Smart car finder</h3>
            <p>Describe what you need — “7-seater diesel under ₹25 lakh” — and we’ll match it to cars in stock.</p>
          </article>
          <article className="card feature">
            <span className="feature-icon"><BadgeCheck size={22} /></span>
            <h3>Transparent pricing</h3>
            <p>Clear ex-showroom prices and full specifications for every car. Compare side-by-side before you decide.</p>
          </article>
          <article className="card feature">
            <span className="feature-icon"><HandCoins size={22} /></span>
            <h3>Reserve with no payment</h3>
            <p>Hold your car for 24 hours online. Pay at the dealership, or ask us to call you back.</p>
          </article>
        </div>
      </section>

      <section className="section container" aria-labelledby="how-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 className="section-title" id="how-title">Three steps to your next car</h2>
          </div>
        </div>
        <div className="steps">
          <div className="step"><span className="step-num">01</span><h3><Search size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />Search</h3><p>Browse the showroom or describe your ideal car to the smart finder.</p></div>
          <div className="step"><span className="step-num">02</span><h3><CalendarCheck size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />Reserve</h3><p>Pick your car and reserve it online. We hold it for you for 24 hours.</p></div>
          <div className="step"><span className="step-num">03</span><h3><MessageSquare size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />Drive away</h3><p>Our team confirms the details and helps you complete payment and delivery.</p></div>
        </div>
      </section>

      <section className="section container" aria-labelledby="cta-title">
        <div className="cta-band">
          <div>
            <h2 id="cta-title">Ready to find your next car?</h2>
            <p>Start browsing, or send us a question and our team will get back to you.</p>
          </div>
          <div className="cta-band-actions">
            <button className="btn btn-primary btn-lg" type="button" onClick={() => navigate(showroomPath)}>Browse cars <ArrowRight size={17} /></button>
            <button className="btn btn-outline-light btn-lg" type="button" onClick={() => navigate('/contact')}>Contact us</button>
          </div>
        </div>
      </section>
    </>
  );
}

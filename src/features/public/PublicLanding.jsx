import React, { useEffect, useState } from 'react';
import { ArrowUpRight, CarFront, Check, ShieldCheck, UserRound } from 'lucide-react';
import { money } from '../../lib/currency-format.js';

export function PublicLanding({ api, navigate, isAdmin, session }) {
  const [featuredVehicles, setFeaturedVehicles] = useState([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [featuredError, setFeaturedError] = useState(false);
  const showroomPath = isAdmin ? '/admin/inventory' : '/showroom';

  useEffect(() => {
    let active = true;
    setLoadingFeatured(true);
    setFeaturedError(false);
    api('/api/public/vehicles?page=1&pageSize=3&sortBy=createdAt&sortOrder=desc')
      .then((result) => {
        if (active) setFeaturedVehicles(result.vehicles);
      })
      .catch(() => {
        if (active) setFeaturedError(true);
      })
      .finally(() => {
        if (active) setLoadingFeatured(false);
      });
    return () => { active = false; };
  }, [api]);

  function follow(event, path) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(path);
  }

  return (
    <>
      <section className="landing-hero" id="top" aria-labelledby="landing-title">
        <img
          className="landing-hero-image"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBU4-_lj0Y2qQDrqVF705J__LybIYgoMli1imgiD1Jd-otTbrcuz282ZhsYu3cdUGUQTO81AiDeRtnkaQpox9YPLD0XokHOiT1emMmA6YRabtJjD617b9kTiZazrwib0puYbGCZi5qoSzpeD20tdOvIFUmZ2cU6dQVu986cTYbFqrlkiBTAlADpJVkI5mSJ3yT88WJ8dr6QjS83hjK1ueluWBmYHbhlEhXeoVtIIDU"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          referrerPolicy="no-referrer"
        />
        <div className="landing-hero-shade" />
        <div className="landing-hero-content">
          <p className="landing-kicker">APEX AUTO <span>·</span> YOUR NEXT CHAPTER STARTS HERE</p>
          <h1 id="landing-title">Find your next<br /><span>great drive.</span></h1>
          <p className="landing-hero-lede">Explore our current collection, review the details, and get in touch with a team ready to help you choose with confidence.</p>
          <div className="landing-hero-actions">
            <button className="landing-primary-button" type="button" onClick={() => navigate(showroomPath)}>
              {isAdmin ? 'Manage inventory' : session ? 'Explore showroom' : 'Explore showroom'} <ArrowUpRight size={17} />
            </button>
            <button className="landing-secondary-button" type="button" onClick={() => navigate('/contact')}>
              Talk to our team
            </button>
          </div>
        </div>

      </section>

      <section className="landing-featured" id="featured-allocations" aria-labelledby="landing-featured-title">
        <div className="landing-section-heading">
          <div>
            <p className="landing-kicker">THE COLLECTION</p>
            <h2 id="landing-featured-title">Explore our <span>latest arrivals.</span></h2>
          </div>
          <a className="landing-view-all" href={showroomPath} onClick={(event) => follow(event, showroomPath)}>
            Browse all vehicles <ArrowUpRight size={16} />
          </a>
        </div>
        {loadingFeatured ? (
          <p className="landing-listing-status" role="status">Loading current listings…</p>
        ) : featuredError ? (
          <p className="landing-listing-status" role="status">Featured listings are temporarily unavailable. Please try the showroom again later.</p>
        ) : featuredVehicles.length ? (
          <div className="landing-vehicle-grid">
            {featuredVehicles.map((vehicle) => {
              const title = `${vehicle.make} ${vehicle.model}`;
              const specifications = [
                vehicle.year,
                vehicle.category,
                vehicle.fuelType,
                vehicle.mileageKmpl ? `${vehicle.mileageKmpl} km/l` : null,
              ].filter(Boolean);
              const vehiclePath = `/vehicles/${encodeURIComponent(vehicle.id)}`;
              return (
                <article className="landing-vehicle-card" key={vehicle.id}>
                  <a className="landing-vehicle-image" href={vehiclePath} onClick={(event) => follow(event, vehiclePath)} aria-label={`View details for ${title}`}>
                    {vehicle.imageUrl ? (
                      <img src={vehicle.imageUrl} alt="" loading="lazy" />
                    ) : (
                      <CarFront size={54} strokeWidth={1} aria-hidden="true" />
                    )}
                    <span className="landing-vehicle-status">{vehicle.quantity > 0 ? 'AVAILABLE' : 'ENQUIRE FOR AVAILABILITY'}</span>
                  </a>
                  <div className="landing-vehicle-content">
                    <p className="landing-vehicle-make">{[vehicle.year, vehicle.make].filter(Boolean).join(' · ')}</p>
                    <h3>{vehicle.model}</h3>
                    <p className="landing-vehicle-specs">{specifications.length ? specifications.join(' · ') : 'Contact us for recorded specifications'}</p>
                    <div className="landing-vehicle-bottom">
                      <strong>{money(vehicle.price)}</strong>
                      <a href={vehiclePath} onClick={(event) => follow(event, vehiclePath)}>
                        View details <ArrowUpRight size={15} />
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="landing-listing-status">There are no vehicles listed at the moment. Please check back soon or contact our team.</p>
        )}
      </section>

      <section className="landing-about" id="about" aria-labelledby="landing-about-title">
        <div className="landing-about-copy">
          <p className="landing-kicker">ABOUT APEX AUTO</p>
          <h2 id="landing-about-title">A more considered way to find <span>your next car.</span></h2>
          <p>Choosing a vehicle should feel informed, personal, and straightforward. We bring our current dealership collection together with clear recorded details and a team ready to answer your questions.</p>
        </div>
        <div className="landing-benefits" id="services">
          <article>
            <span className="landing-benefit-icon"><Check size={21} /></span>
            <h3>Current listings</h3>
            <p>Browse our latest vehicles, with pricing and availability in one place.</p>
          </article>
          <article>
            <span className="landing-benefit-icon"><ShieldCheck size={21} /></span>
            <h3>Clear information</h3>
            <p>Review the specifications available for each listing and ask us to clarify what matters to you.</p>
          </article>
          <article>
            <span className="landing-benefit-icon"><UserRound size={21} /></span>
            <h3>Personal guidance</h3>
            <p>Send an enquiry to start a conversation with the dealership team at your own pace.</p>
          </article>
        </div>
      </section>

      <section className="landing-contact-cta" aria-labelledby="landing-contact-title">
        <div>
          <p className="landing-kicker">YOUR NEXT DRIVE STARTS HERE</p>
          <h2 id="landing-contact-title">Ready to find your <span>next car?</span></h2>
          <p>Explore the showroom or send us a question about a vehicle.</p>
        </div>
        <button className="landing-primary-button" type="button" onClick={() => navigate('/contact')}>
          Talk with our team <ArrowUpRight size={17} />
        </button>
      </section>
    </>
  );
}

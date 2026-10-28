import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, MessageSquare, ShieldCheck } from 'lucide-react';
import { money } from '../../lib/currency-format.js';
import { VehicleImage } from '../../components/VehicleImage.jsx';
import { stockBadge, titleCase } from '../../lib/vehicle-labels.js';

export function PublicVehiclePage({ api, vehicleId, navigate, onPurchase }) {
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reserving, setReserving] = useState(false);

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

  async function reserve() {
    setReserving(true);
    const updated = await onPurchase(vehicle);
    setReserving(false);
    if (updated) setVehicle((current) => ({ ...current, quantity: updated.quantity }));
  }

  if (loading) return <div className="loading-block" role="status"><span className="spinner" /> Loading car details…</div>;
  if (error || !vehicle) {
    return (
      <section className="container page">
        <div className="card empty">
          <h3>We couldn’t find that car</h3>
          <p>It may have been sold or removed from the showroom.</p>
          <button className="btn btn-dark" type="button" onClick={() => navigate('/')}>Back to home</button>
        </div>
      </section>
    );
  }

  const details = [
    ['Year', vehicle.year], ['Variant', vehicle.variant], ['Body type', vehicle.bodyType || vehicle.category],
    ['Fuel', titleCase(vehicle.fuelType)], ['Transmission', titleCase(vehicle.transmission)],
    ['Seats', vehicle.seatingCapacity], ['Mileage', vehicle.mileageKmpl ? `${vehicle.mileageKmpl} km/l` : null],
    ['Electric range', vehicle.electricRangeKm ? `${vehicle.electricRangeKm} km` : null],
    ['Engine', vehicle.engineCapacityCc ? `${vehicle.engineCapacityCc} cc` : null],
    ['Ground clearance', vehicle.groundClearanceMm ? `${vehicle.groundClearanceMm} mm` : null],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  const badge = stockBadge(vehicle);
  const soldOut = vehicle.quantity < 1;

  return (
    <article className="container page">
      <button className="breadcrumb" type="button" onClick={() => navigate(onPurchase ? '/showroom' : '/')}><ArrowLeft size={16} /> {onPurchase ? 'Back to showroom' : 'Back to home'}</button>
      <div className="detail">
        <VehicleImage vehicle={vehicle} className="detail-media" iconSize={140} alt={`${vehicle.make} ${vehicle.model}`} />
        <div className="detail-info">
          <span className={badge.tone} style={{ marginBottom: 14 }}>{badge.label}</span>
          <p className="detail-make">{[vehicle.year, vehicle.make, vehicle.variant].filter(Boolean).join(' · ')}</p>
          <h1>{vehicle.model}</h1>
          <p className="detail-price"><small>Ex-showroom price</small>{money(vehicle.price)}</p>
          <div className="detail-actions">
            {onPurchase ? (
              <button className="btn btn-primary btn-lg" type="button" disabled={soldOut || reserving} onClick={reserve}>
                {soldOut ? 'Sold out' : <>Reserve this car <ArrowRight size={16} /></>}
              </button>
            ) : (
              <button className="btn btn-primary btn-lg" type="button" disabled={soldOut} onClick={() => navigate('/login')}>{soldOut ? 'Sold out' : <>Sign in to reserve <ArrowRight size={16} /></>}</button>
            )}
            <button className="btn btn-secondary btn-lg" type="button" onClick={() => navigate(`/contact?vehicle=${encodeURIComponent(vehicle.id)}`)}><MessageSquare size={16} /> Ask a question</button>
          </div>
          {vehicle.description && <p className="detail-desc">{vehicle.description}</p>}
          <div className="detail-perks">
            <div><Check size={16} /> Free 24-hour reservation hold</div>
            <div><Check size={16} /> No online payment required</div>
            <div><Check size={16} /> Our team confirms every detail with you</div>
          </div>
        </div>
      </div>
      {details.length > 0 && (
        <section className="section" style={{ paddingTop: 56 }} aria-labelledby="specs-title">
          <h2 className="section-title" id="specs-title" style={{ marginBottom: 20 }}>Specifications</h2>
          <dl className="spec-grid">{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {vehicle.safetyFeatures && <div className="card safety-note"><strong><ShieldCheck size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />Safety:</strong> {vehicle.safetyFeatures}</div>}
        </section>
      )}
    </article>
  );
}

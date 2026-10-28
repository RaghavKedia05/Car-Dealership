import React, { useEffect, useState } from 'react';
import { ArrowUpRight, CarFront } from 'lucide-react';
import { money } from '../../lib/currency-format.js';

export function PublicVehiclePage({ api, vehicleId, navigate }) {
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

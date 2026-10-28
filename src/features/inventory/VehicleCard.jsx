import React from 'react';
import { ArrowRight, Fuel, Pencil, Settings2, Trash2, Users } from 'lucide-react';
import { money } from '../../lib/currency-format.js';
import { VehicleImage } from '../../components/VehicleImage.jsx';
import { stockBadge, titleCase } from '../../lib/vehicle-labels.js';

export function VehicleCard({ vehicle, isAdmin, busy, onPurchase, onEdit, onDelete, navigate }) {
  const soldOut = vehicle.quantity === 0;
  const badge = stockBadge(vehicle);
  const detailPath = `/vehicles/${encodeURIComponent(vehicle.id)}`;
  const title = `${vehicle.make} ${vehicle.model}`;
  const openDetails = (event) => {
    if (isAdmin || !navigate) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(detailPath);
  };
  const specs = [
    vehicle.fuelType && [Fuel, titleCase(vehicle.fuelType)],
    vehicle.transmission && [Settings2, titleCase(vehicle.transmission)],
    vehicle.seatingCapacity && [Users, `${vehicle.seatingCapacity} seats`],
  ].filter(Boolean);

  const media = (
    <VehicleImage vehicle={vehicle} alt={title}>
      <span className={badge.tone}>{badge.label}</span>
      <span className="badge badge-dark vehicle-category">{vehicle.category}</span>
    </VehicleImage>
  );

  return (
    <article className="vehicle-card">
      {isAdmin ? media : <a href={detailPath} onClick={openDetails} aria-label={`View ${title}`}>{media}</a>}
      <div className="vehicle-body">
        <span className="vehicle-make">{[vehicle.year, vehicle.make].filter(Boolean).join(' · ')}</span>
        <h3 className="vehicle-title">{isAdmin ? vehicle.model : <a href={detailPath} onClick={openDetails}>{vehicle.model}</a>}</h3>
        {vehicle.variant && <span className="vehicle-variant">{vehicle.variant}</span>}
        {specs.length > 0 && (
          <ul className="spec-list">
            {specs.map(([Icon, label]) => <li key={label}><Icon size={14} /> {label}</li>)}
          </ul>
        )}
        <div className="vehicle-foot">
          <div>
            <span className="price-label">{isAdmin ? `${vehicle.quantity} in stock` : 'Ex-showroom'}</span>
            <span className="price">{money(vehicle.price)}</span>
          </div>
          {!isAdmin && (
            <button
              className="btn btn-dark btn-sm"
              type="button"
              disabled={soldOut || busy || vehicle.status === 'unlisted'}
              onClick={() => onPurchase(vehicle)}
            >
              {busy ? <span className="spinner spinner-sm" /> : soldOut ? 'Sold out' : <>Reserve <ArrowRight size={14} /></>}
            </button>
          )}
        </div>
        {isAdmin && (
          <div className="vehicle-admin">
            <button className="btn btn-secondary btn-sm" type="button" onClick={onEdit}><Pencil size={14} /> Edit</button>
            <button className="btn btn-danger btn-sm" type="button" disabled={busy} onClick={() => onDelete(vehicle)}><Trash2 size={14} /> Remove</button>
          </div>
        )}
      </div>
    </article>
  );
}

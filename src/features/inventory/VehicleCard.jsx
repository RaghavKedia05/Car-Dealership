import React from 'react';
import { ArrowUpRight, CarFront, Gauge, SlidersHorizontal, X } from 'lucide-react';
import { money } from '../../lib/currency-format.js';

export function VehicleCard({ vehicle, index, isAdmin, busy, onPurchase, onEdit, onDelete, onDetails }) {
  const soldOut = vehicle.quantity === 0;
  const variant = index % 4;

  return (
    <article className={`vehicle-card ${variant === 1 ? 'vehicle-card-sand' : ''} ${variant === 2 ? 'vehicle-card-blue' : ''}`}>
      <div className={`vehicle-artwork artwork-${variant}`}>
        <span className="vehicle-stock">{vehicle.status === 'unlisted' ? 'UNLISTED' : soldOut ? 'SOLD OUT' : `${String(vehicle.quantity).padStart(2, '0')} AVAILABLE`}</span>
        {vehicle.imageUrl ? <img className="vehicle-photo" src={vehicle.imageUrl} alt={`${vehicle.make} ${vehicle.model}`} loading="lazy" /> : (
          <>
            <div className="vehicle-art-circle" />
            <CarFront className="vehicle-illustration" strokeWidth={0.85} aria-hidden="true" />
            <span className="vehicle-art-label">Photo coming soon</span>
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
          <span><Gauge size={15} /> {vehicle.fuelType || 'Fuel details on request'}</span>
          <span><CarFront size={15} /> {vehicle.transmission || vehicle.category}</span>
        </div>
        {!isAdmin && <button className="vehicle-details-link" type="button" onClick={onDetails}>View vehicle details <ArrowUpRight size={15} /></button>}
        <div className="vehicle-card-footer">
          <div><span className="price-caption">PRICE</span><span className="vehicle-price">{money(vehicle.price)}</span></div>
          {!isAdmin && (
            <button
              className={`purchase-button ${soldOut ? 'purchase-disabled' : ''}`}
              type="button"
              disabled={soldOut || busy || vehicle.status === 'unlisted'}
              onClick={() => onPurchase(vehicle)}
            >
              {busy ? <span className="loading-spinner spinner-small" /> : vehicle.status === 'unlisted' ? 'Unlisted' : soldOut ? 'Sold out' : <>Request car <ArrowUpRight size={15} /></>}
            </button>
          )}
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

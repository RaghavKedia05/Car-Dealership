import React, { useRef } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility.js';
import { CATEGORIES } from '../../lib/vehicle-categories.js';

export function VehicleEditor({ value, setValue, busy, onSubmit, onClose }) {
  const dialogRef = useRef(null);
  useDialogAccessibility(dialogRef, onClose);

  function update(field, next) {
    setValue((current) => ({ ...current, [field]: next }));
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="modal modal-lg" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="vehicle-editor-title" onSubmit={onSubmit} tabIndex="-1">
        <div className="modal-head">
          <div>
            <h2 id="vehicle-editor-title">{value.vehicle ? `Edit ${value.vehicle.make} ${value.vehicle.model}` : 'Add a new vehicle'}</h2>
            <p>{value.vehicle ? 'Update pricing, stock, and listing details.' : 'Add the basics now — you can fill in specifications any time.'}</p>
          </div>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="form-grid">
          <label className="field">Make<input required maxLength="60" value={value.make} onChange={(event) => update('make', event.target.value)} placeholder="e.g. Hyundai" /></label>
          <label className="field">Model<input required maxLength="60" value={value.model} onChange={(event) => update('model', event.target.value)} placeholder="e.g. Creta" /></label>
          <label className="field">Category<select value={value.category} onChange={(event) => update('category', event.target.value)}>{CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="field">Variant<input maxLength="80" value={value.variant} onChange={(event) => update('variant', event.target.value)} placeholder="e.g. SX(O) IVT" /></label>
          <label className="field">Price (₹)<input required type="number" min="0.01" step="0.01" value={value.price} onChange={(event) => update('price', event.target.value)} placeholder="1650000" /></label>
          <label className="field">Units in stock<input required type="number" min="0" step="1" value={value.quantity} onChange={(event) => update('quantity', event.target.value)} /></label>
          <label className="field">Visibility<select value={value.status} onChange={(event) => update('status', event.target.value)}><option value="listed">Listed — visible to customers</option><option value="unlisted">Hidden — draft</option></select></label>
          <label className="field">Model year<input type="number" min="1886" max="2100" step="1" value={value.year} onChange={(event) => update('year', event.target.value)} placeholder="2024" /></label>
          <label className="field span-2">Image URL <span className="field-hint">Optional · link to a hosted photo (https://…)</span><input type="url" maxLength="2048" value={value.imageUrl} onChange={(event) => update('imageUrl', event.target.value)} placeholder="https://" /></label>
        </div>
        <details className="disclosure" open={Boolean(value.vehicle)}>
          <summary><span>Specifications & description <small>— optional</small></span><ChevronDown size={16} /></summary>
          <div className="form-grid">
            <label className="field">Body type<input maxLength="40" value={value.bodyType} onChange={(event) => update('bodyType', event.target.value)} placeholder="e.g. Compact SUV" /></label>
            <label className="field">Fuel type<select value={value.fuelType} onChange={(event) => update('fuelType', event.target.value)}><option value="">Select…</option>{[['petrol', 'Petrol'], ['diesel', 'Diesel'], ['electric', 'Electric'], ['hybrid', 'Hybrid'], ['cng', 'CNG'], ['lpg', 'LPG']].map(([item, label]) => <option key={item} value={item}>{label}</option>)}</select></label>
            <label className="field">Transmission<select value={value.transmission} onChange={(event) => update('transmission', event.target.value)}><option value="">Select…</option><option value="automatic">Automatic</option><option value="manual">Manual</option></select></label>
            <label className="field">Seats<input type="number" min="1" max="20" step="1" value={value.seatingCapacity} onChange={(event) => update('seatingCapacity', event.target.value)} /></label>
            <label className="field">Mileage (km/l)<input type="number" min="0.1" max="200" step="0.1" value={value.mileageKmpl} onChange={(event) => update('mileageKmpl', event.target.value)} /></label>
            <label className="field">EV range (km)<input type="number" min="0.1" max="3000" step="0.1" value={value.electricRangeKm} onChange={(event) => update('electricRangeKm', event.target.value)} /></label>
            <label className="field">Engine (cc)<input type="number" min="1" max="20000" step="1" value={value.engineCapacityCc} onChange={(event) => update('engineCapacityCc', event.target.value)} /></label>
            <label className="field">Ground clearance (mm)<input type="number" min="1" max="1000" step="1" value={value.groundClearanceMm} onChange={(event) => update('groundClearanceMm', event.target.value)} /></label>
            <label className="field span-2">Safety features<input maxLength="500" value={value.safetyFeatures} onChange={(event) => update('safetyFeatures', event.target.value)} placeholder="e.g. 6 airbags, ESC, ADAS" /></label>
            <label className="field span-2">Description<textarea maxLength="4000" rows="4" value={value.description} onChange={(event) => update('description', event.target.value)} placeholder="A short description customers will see on the car’s page." /></label>
          </div>
        </details>
        <div className="modal-foot">
          <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} type="submit">{busy ? 'Saving…' : value.vehicle ? 'Save changes' : 'Add vehicle'}</button>
        </div>
      </form>
    </div>
  );
}

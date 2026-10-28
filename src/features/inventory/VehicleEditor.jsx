import React, { useRef } from 'react';
import { ArrowUpRight, CarFront, X } from 'lucide-react';
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

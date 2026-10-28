import React, { useRef, useState } from 'react';
import { ArrowRight, CircleAlert, Fuel, Gauge, Search, Settings2, Share2, Sparkles, Users, X } from 'lucide-react';
import { apiUrl, reportError, parseApiResponse } from '../../lib/api-client.js';
import { money } from '../../lib/currency-format.js';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility.js';
import { VehicleImage } from '../../components/VehicleImage.jsx';
import { RELAXED_LABELS, titleCase } from '../../lib/vehicle-labels.js';

const SUGGESTIONS = [
  'Family SUV under ₹20 lakh with 5+ seats',
  'Automatic car for city driving under ₹15 lakh',
  'Electric car with long range',
  'Fuel-efficient petrol car under ₹10 lakh',
];

const SPEC_LABELS = {
  bodyType: 'Body type', year: 'Year', fuelType: 'Fuel', transmission: 'Transmission', seatingCapacity: 'Seats',
  mileageKmpl: 'Mileage', electricRangeKm: 'Electric range', engineCapacityCc: 'Engine', groundClearanceMm: 'Ground clearance', safetyFeatures: 'Safety',
};
const SPEC_UNITS = { mileageKmpl: ' km/l', electricRangeKm: ' km', engineCapacityCc: ' cc', groundClearanceMm: ' mm' };

function formatSpec(key, value) {
  if (value === null || value === undefined || value === '') return null;
  return `${['fuelType', 'transmission'].includes(key) ? titleCase(value) : value}${SPEC_UNITS[key] || ''}`;
}

export function AICarFinder({ session, onPurchase, onUnauthorized }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [details, setDetails] = useState(null);
  const [shareNotice, setShareNotice] = useState('');
  const detailsDialogRef = useRef(null);
  useDialogAccessibility(detailsDialogRef, () => setDetails(null), Boolean(details));

  async function authorizedPost(path, payload, fallback) {
    const response = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
      body: JSON.stringify(payload),
    });
    return parseApiResponse(response, fallback);
  }

  async function submit(nextQuery = query) {
    const cleanQuery = nextQuery.trim();
    if (!session) return;
    if (cleanQuery.length < 3) {
      setError('Tell us a little more about the car you want — for example, budget, seats, or fuel type.');
      return;
    }
    setQuery(cleanQuery);
    setLoading(true);
    setError('');
    setShareNotice('');
    setComparison(null);
    setSelectedIds([]);
    try {
      const body = await authorizedPost('/api/ai/car-finder', { query: cleanQuery.slice(0, 2000) }, 'We couldn’t complete that search. Please try again.');
      setResult(body);
      window.requestAnimationFrame(() => document.getElementById('finder-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (failure) {
      if (failure instanceof TypeError) reportError(failure);
      setError(failure instanceof TypeError ? 'We can’t connect right now. Please try again.' : failure.message);
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
    try {
      const body = await authorizedPost('/api/ai/car-finder/compare', { vehicle_ids: selectedIds, original_query: query }, 'We couldn’t compare those cars. Please try again.');
      setComparison(body);
      window.requestAnimationFrame(() => document.getElementById('comparison')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (failure) {
      if (failure instanceof TypeError) reportError(failure);
      setError(failure instanceof TypeError ? 'We can’t connect right now. Please try again.' : failure.message);
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
    const url = `${window.location.origin}/vehicles/${vehicle.id}`;
    const text = `${title} · ${money(vehicle.price)} at Apex Auto`;
    setShareNotice('');
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${text} — ${url}`);
        setShareNotice('Link copied to clipboard.');
      }
    } catch (shareError) {
      if (shareError.name !== 'AbortError') setShareNotice('Couldn’t share this car. Please try again.');
    }
  }

  const allItems = result ? [...result.matches, ...result.alternatives] : [];
  const selectedNames = allItems.filter((item) => selectedIds.includes(item.vehicle.id)).map((item) => `${item.vehicle.make} ${item.vehicle.model}`);

  function recommendationCard(item) {
    const vehicle = item.vehicle;
    const specs = vehicle.specifications || {};
    const isSelected = selectedIds.includes(vehicle.id);
    const soldOut = vehicle.quantity < 1;
    const chips = [
      specs.fuelType && [Fuel, titleCase(specs.fuelType)],
      specs.transmission && [Settings2, titleCase(specs.transmission)],
      specs.seatingCapacity && [Users, `${specs.seatingCapacity} seats`],
      (specs.mileageKmpl || specs.electricRangeKm) && [Gauge, specs.mileageKmpl ? `${specs.mileageKmpl} km/l` : `${specs.electricRangeKm} km`],
    ].filter(Boolean);
    return (
      <article className="vehicle-card match-card" key={vehicle.id}>
        <VehicleImage vehicle={vehicle}>
          <span className={item.isExactMatch ? 'badge badge-success' : 'badge badge-warning'}>
            {item.isExactMatch ? 'Great match' : `Close match · ${RELAXED_LABELS[item.relaxedConstraint] || 'one change'}`}
          </span>
          <span className="badge badge-dark vehicle-category">{vehicle.category}</span>
        </VehicleImage>
        <div className="vehicle-body">
          <span className="vehicle-make">{[specs.year, vehicle.make].filter(Boolean).join(' · ')}</span>
          <h3 className="vehicle-title">{vehicle.model}</h3>
          {chips.length > 0 && <ul className="spec-list">{chips.map(([Icon, label]) => <li key={label}><Icon size={14} /> {label}</li>)}</ul>}
          {item.reasons?.length > 0 && <p className="match-reason">{item.reasons.join(' ')}</p>}
          {item.tradeOffs?.length > 0 && <ul className="match-tradeoffs">{item.tradeOffs.map((tradeOff) => <li key={tradeOff}>{tradeOff}</li>)}</ul>}
          <label className="compare-toggle">
            <input type="checkbox" checked={isSelected} disabled={!isSelected && selectedIds.length >= 3} onChange={() => toggleSelection(vehicle.id)} />
            Compare
          </label>
          <div className="vehicle-foot">
            <div><span className="price-label">Ex-showroom</span><span className="price">{money(vehicle.price)}</span></div>
            <div className="match-actions">
              <button type="button" className="icon-btn" onClick={() => shareVehicle(vehicle)} aria-label={`Share ${vehicle.make} ${vehicle.model}`}><Share2 size={15} /></button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDetails(item)}>Details</button>
              <button type="button" className="btn btn-dark btn-sm" disabled={soldOut} onClick={() => purchaseRecommendation(vehicle)}>{soldOut ? 'Sold out' : 'Reserve'}</button>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <section id="finder">
      <div className="finder">
        <div className="finder-head">
          <div>
            <p className="eyebrow"><Sparkles size={14} /> Smart car finder</p>
            <h1 className="page-title">What are you looking for?</h1>
            <p>Describe your ideal car in your own words — budget, seats, fuel, how you’ll use it — and we’ll find the best matches in our showroom.</p>
          </div>
        </div>
        <form className="finder-box" onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <Search size={20} />
          <label htmlFor="car-finder-query" className="sr-only">Describe the car you want</label>
          <textarea
            id="car-finder-query"
            rows="1"
            maxLength="2000"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="e.g. A spacious automatic SUV for family road trips under ₹20 lakh"
          />
          {result && <button className="btn btn-ghost" type="button" onClick={clearSearch}>Clear</button>}
          <button className="btn btn-primary" type="submit" disabled={loading || !session}>
            {loading ? <><span className="spinner spinner-sm" /> Searching…</> : <>Find cars <ArrowRight size={16} /></>}
          </button>
        </form>
        <div className="chips" aria-label="Try a search">
          {SUGGESTIONS.map((suggestion) => (
            <button className="chip" key={suggestion} type="button" disabled={!session || loading} onClick={() => submit(suggestion)}>{suggestion}</button>
          ))}
        </div>
        {error && <div className="alert alert-error" role="alert"><CircleAlert size={16} /><span>{error}</span></div>}
      </div>

      {shareNotice && <div className="alert alert-success" role="status" style={{ marginTop: 16 }}><span>{shareNotice}</span></div>}

      {result && (
        <div className="finder-results" id="finder-results" aria-live="polite">
          <div className="result-summary">
            <div>
              <h2>{result.needsClarification ? 'Tell us a bit more' : result.matches.length ? `${result.matches.length} car${result.matches.length === 1 ? '' : 's'} match your search` : 'No exact matches — here are close options'}</h2>
              <p>{result.needsClarification ? result.clarificationQuestion : `For “${query}”`}</p>
            </div>
          </div>
          {!result.needsClarification && (
            <>
              {(result.criteria?.mustHave?.length > 0 || result.criteria?.preferences?.length > 0) && (
                <div className="criteria">
                  {result.criteria.mustHave?.map((criterion) => <span className="badge" key={criterion}>{criterion}</span>)}
                  {result.criteria.preferences?.map((preference) => <span className="badge badge-accent" key={preference}>Prefers {preference.replaceAll('_', ' ')}</span>)}
                </div>
              )}
              {result.matches.length > 0 && <div className="vehicle-grid">{result.matches.map(recommendationCard)}</div>}
              {result.alternatives.length > 0 && (
                <>
                  <h3 className="result-group-title">Worth considering <small>Each of these differs from your search in one way</small></h3>
                  <div className="vehicle-grid">{result.alternatives.map(recommendationCard)}</div>
                </>
              )}
              {!result.matches.length && !result.alternatives.length && (
                <div className="card empty">
                  <div className="empty-icon"><Search size={24} /></div>
                  <h3>No cars match that search yet</h3>
                  <p>Try a different budget or body style, or browse the full showroom below.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {comparison && (
        <div className="comparison" id="comparison" aria-live="polite">
          <div className="result-summary">
            <div><h2>Side-by-side comparison</h2>{comparison.summary && <p>{comparison.summary}</p>}</div>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setComparison(null)}>Close</button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">&nbsp;</th>{comparison.vehicles.map((vehicle) => <th scope="col" key={vehicle.id}>{vehicle.make} {vehicle.model}</th>)}</tr></thead>
              <tbody>
                {comparison.rows.filter((row) => row.key !== 'make').map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.label.replace(' (INR)', '')}</th>
                    {row.values.map((value, index) => (
                      <td key={`${row.key}-${comparison.vehicles[index].id}`} style={{ textTransform: 'capitalize' }}>
                        {row.key === 'price' ? money(value) : value === null ? '—' : String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {details && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetails(null); }}>
          <div className="modal" ref={detailsDialogRef} role="dialog" aria-modal="true" aria-labelledby="finder-details-title" tabIndex="-1">
            <div className="modal-head">
              <div>
                <h2 id="finder-details-title">{details.vehicle.make} {details.vehicle.model}</h2>
                <p>{details.vehicle.category} · {money(details.vehicle.price)}</p>
              </div>
              <button className="icon-btn" type="button" aria-label="Close" onClick={() => setDetails(null)}><X size={18} /></button>
            </div>
            <dl className="spec-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              {Object.entries(details.vehicle.specifications || {})
                .map(([key, value]) => [key, formatSpec(key, value)])
                .filter(([, value]) => value)
                .map(([key, value]) => <div key={key}><dt>{SPEC_LABELS[key] || key}</dt><dd>{value}</dd></div>)}
            </dl>
            {details.tradeOffs?.length > 0 && <ul className="match-tradeoffs" style={{ marginTop: 16 }}>{details.tradeOffs.map((tradeOff) => <li key={tradeOff}>{tradeOff}</li>)}</ul>}
            <div className="modal-foot">
              <button className="btn btn-secondary" type="button" onClick={() => setDetails(null)}>Close</button>
              <button className="btn btn-primary" type="button" disabled={details.vehicle.quantity < 1} onClick={() => purchaseRecommendation(details.vehicle)}>
                {details.vehicle.quantity < 1 ? 'Sold out' : <>Reserve this car <ArrowRight size={16} /></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="compare-dock" role="region" aria-label="Compare cars">
          <div>
            <small>{selectedIds.length} of 3 selected</small>
            <strong>{selectedIds.length < 2 ? 'Select one more car to compare' : selectedNames.join(' vs ')}</strong>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" style={{ color: '#fff' }} type="button" onClick={() => setSelectedIds([])}>Clear</button>
            <button className="btn btn-primary btn-sm" type="button" disabled={selectedIds.length < 2 || comparing} onClick={compareSelected}>
              {comparing ? 'Comparing…' : 'Compare'} <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

import React, { useRef, useState } from 'react';
import { Activity, ArrowUpRight, CarFront, ChevronDown, Database, LockKeyhole, Search, Share2, Sparkles, Terminal, X } from 'lucide-react';
import { apiUrl, reportError, parseApiResponse } from '../../lib/api-client.js';
import { money } from '../../lib/currency-format.js';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility.js';

export function AICarFinder({ session, onPurchase, onUnauthorized, apiStatus }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [details, setDetails] = useState(null);
  const [searchRequest, setSearchRequest] = useState(null);
  const [compareRequest, setCompareRequest] = useState(null);
  const [shareNotice, setShareNotice] = useState('');
  const detailsDialogRef = useRef(null);
  useDialogAccessibility(detailsDialogRef, () => setDetails(null), Boolean(details));

  const suggestions = [
    'Family SUV under ₹20 lakh with at least five seats',
    'Automatic car for city driving under ₹15 lakh',
    'Electric car with a long driving range',
    'Fuel-efficient petrol car under ₹10 lakh',
  ];

  async function submit(nextQuery = query) {
    const cleanQuery = nextQuery.trim();
    if (!session) {
      setError('Sign in to search the live vehicle inventory.');
      reportError(new Error('Sign in to search the live vehicle inventory.'));
      return;
    }
    if (cleanQuery.length < 3 || cleanQuery.length > 2000) {
      setError('Enter a request between 3 and 2,000 characters.');
      reportError(new Error('Enter a request between 3 and 2,000 characters.'));
      return;
    }
    setQuery(cleanQuery);
    setLoading(true);
    setError('');
    setShareNotice('');
    setComparison(null);
    setSelectedIds([]);
    const startedAt = performance.now();
    try {
      const response = await fetch(apiUrl('/api/ai/car-finder'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ query: cleanQuery }),
      });
      setSearchRequest({ status: response.status, latency: Math.round(performance.now() - startedAt) });
      const body = await parseApiResponse(response, 'Car Finder could not complete this search.');
      setResult(body);
    } catch (failure) {
      if (failure.status === undefined) {
        setSearchRequest({ status: 'network-error', latency: Math.round(performance.now() - startedAt) });
        reportError(failure);
      }
      setError(failure.message || 'Network error while searching the vehicle inventory.');
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
    const startedAt = performance.now();
    try {
      const response = await fetch(apiUrl('/api/ai/car-finder/compare'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ vehicle_ids: selectedIds, original_query: query }),
      });
      setCompareRequest({ status: response.status, latency: Math.round(performance.now() - startedAt) });
      const body = await parseApiResponse(response, 'The selected vehicles could not be compared.');
      setComparison(body);
      window.requestAnimationFrame(() => {
        document.getElementById('comparison')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (failure) {
      if (failure.status === undefined) {
        setCompareRequest({ status: 'network-error', latency: Math.round(performance.now() - startedAt) });
        reportError(failure);
      }
      setError(failure.message || 'Network error while comparing vehicles.');
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
    const text = `${title} · ${money(vehicle.price)} · ${vehicle.quantity} in stock`;
    setShareNotice('');
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: `${window.location.origin}/#inventory` });
        setShareNotice(`${title} shared.`);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${text} — ${window.location.origin}/#inventory`);
        setError('');
        setShareNotice('Vehicle details copied to the clipboard.');
      } else {
        setError('Sharing is not available in this browser.');
        reportError(new Error('Sharing is not available in this browser.'));
      }
    } catch (shareError) {
      if (shareError.name !== 'AbortError') {
        setShareNotice('');
        setError('Could not share this vehicle. Please try again.');
        reportError(new Error('Could not share this vehicle. Please try again.'));
      }
    }
  }

  const selectedVehicles = result
    ? [...result.matches, ...result.alternatives]
      .filter((item) => selectedIds.includes(item.vehicle.id))
      .map((item) => `${item.vehicle.make} ${item.vehicle.model}`)
    : [];

  function requestLabel(request) {
    if (!request) return 'NOT CALLED';
    if (request.status === 'network-error') return 'NETWORK ERROR';
    return `HTTP ${request.status} · ${request.latency} MS`;
  }

  function recommendationCard(item) {
    const vehicle = item.vehicle;
    const specs = vehicle.specifications || {};
    const isSelected = selectedIds.includes(vehicle.id);
    return (
      <article className="finder-card" key={vehicle.id}>
        <div className="vehicle-art">
          <div className="vehicle-art-grid" />
          <span className={`finder-match-label ${item.isExactMatch ? 'is-exact' : 'is-alternative'}`}>
            {item.isExactMatch ? 'EXACT MATCH' : `ALTERNATIVE · RELAXED ${item.relaxedConstraint}`}
          </span>
          <CarFront size={80} strokeWidth={0.9} aria-hidden="true" />
          <span className={`vehicle-stock-indicator ${vehicle.quantity < 1 ? 'is-sold-out' : ''}`}>
            <span />{vehicle.quantity > 0 ? `${vehicle.quantity} IN STOCK` : 'OUT OF STOCK'}
          </span>
        </div>
        <div className="finder-card-content">
          <div className="finder-card-title">
            <div>
              <p className="finder-card-make">{(vehicle.year || specs.year) ? `${vehicle.year || specs.year} · ` : ''}{vehicle.make} · {vehicle.category}</p>
              <h3>{vehicle.model}</h3>
            </div>
            <p className="finder-price">{money(vehicle.price)}</p>
          </div>
          <div className="finder-card-specs">
            {[
              ['FUEL', specs.fuelType],
              ['TRANSMISSION', specs.transmission],
              ['SEATS', specs.seatingCapacity],
              ['MILEAGE', specs.mileageKmpl ? `${specs.mileageKmpl} km/l` : null],
              ['RANGE', specs.electricRangeKm ? `${specs.electricRangeKm} km` : null],
              ['ENGINE', specs.engineCapacityCc ? `${specs.engineCapacityCc} cc` : null],
            ].map(([label, value]) => (
              <div key={label}><span>{label}</span><strong>{value ?? 'Not recorded'}</strong></div>
            ))}
          </div>
          <p className="finder-reason">{item.reasons?.length
            ? item.reasons.join(' ')
            : 'Matches the stated vehicle requirements.'}</p>
        {item.tradeOffs?.length > 0 && (
          <ul className="finder-tradeoffs">
            {item.tradeOffs.map((tradeOff) => <li key={tradeOff}>{tradeOff}</li>)}
          </ul>
        )}
        {item.alternativeExplanation && <p className="finder-alternative-copy">{item.alternativeExplanation}</p>}
        <div className="finder-card-actions">
          <button type="button" className="finder-secondary" onClick={() => setDetails(item)}>View details</button>
          <button type="button" className="finder-share" onClick={() => shareVehicle(vehicle)} aria-label={`Share ${vehicle.make} ${vehicle.model}`}>
            <Share2 size={16} />
          </button>
          <button
            type="button"
            className="purchase-button"
            disabled={vehicle.quantity < 1}
            onClick={() => purchaseRecommendation(vehicle)}
          >
            {vehicle.quantity < 1 ? 'Sold out' : 'Purchase'}
          </button>
        </div>
        <label className="compare-select">
          <input
            type="checkbox"
            checked={isSelected}
            disabled={!isSelected && selectedIds.length >= 3}
            onChange={() => toggleSelection(vehicle.id)}
            aria-label={`Select ${vehicle.make} ${vehicle.model} for comparison`}
          />
          Add to comparison
        </label>
        </div>
      </article>
    );
  }

  return (
    <section className="finder-section" id="ai-finder">
      <div className="finder-topline">
        <div className="finder-heading">
          <p className="eyebrow"><span className="eyebrow-line" /> NATURAL LANGUAGE · LIVE INVENTORY</p>
          <h1>Find the car<br />that fits <span>your life.</span></h1>
          <p>Describe what matters. We’ll match your needs against vehicles currently in this showroom.</p>
        </div>
        <div className="finder-live-card" role="status">
          <div className={`finder-live-icon ${apiStatus.state}`}><Database size={19} /></div>
          <div>
            <span>INVENTORY CONNECTION</span>
            <strong>{apiStatus.state === 'online' ? 'Database verified' : apiStatus.state === 'checking' ? 'Checking connection' : 'Connection unavailable'}</strong>
            <small>{apiStatus.state === 'online' && apiStatus.latency !== null
              ? `Health check · ${apiStatus.latency} ms`
              : apiStatus.state === 'checking' ? 'Verifying API and database' : 'Search and inventory may be unavailable'}</small>
          </div>
        </div>
      </div>
      <div className="finder-search">
        <div className="finder-query-heading"><Sparkles size={18} /><label htmlFor="car-finder-query">DESCRIBE YOUR NEXT CAR</label></div>
        <textarea
          id="car-finder-query"
          aria-describedby="finder-query-help"
          rows="3"
          maxLength="2000"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="e.g. A spacious automatic SUV for family road trips under ₹20 lakh…"
        />
        <div className="finder-submit-row">
          <span id="finder-query-help"><LockKeyhole size={13} /> {query.length}/2,000 · Your search text only; account and payment details are not used.</span>
          <div>
            {result && <button className="finder-secondary" type="button" onClick={clearSearch}>Clear</button>}
            <button className="finder-submit" type="button" disabled={loading || !session} onClick={() => submit()}>
              {loading ? <><span className="loading-spinner spinner-small" /> Searching…</> : <><Sparkles size={15} /> Find vehicles</>}
            </button>
          </div>
        </div>
      </div>

      {!session && <p className="finder-auth-note">Sign in to search current inventory and compare vehicles.</p>}
      {error && <div className="notice notice-error finder-notice" role="alert">{error}</div>}
      {shareNotice && <p className="share-notice" role="status">{shareNotice}</p>}

      <div className="finder-suggestions" aria-label="Suggested searches">
        <span>QUICK SEARCH</span>
        {suggestions.map((suggestion) => (
          <button key={suggestion} type="button" disabled={!session || loading} onClick={() => submit(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>

      <details className="api-verification">
        <summary><Terminal size={15} /> API &amp; DATA VERIFICATION <ChevronDown size={15} /></summary>
        <div className="verification-grid">
          <div><span><Database size={14} /> API / DATABASE HEALTH</span><strong>{apiStatus.state === 'online' ? `VERIFIED${apiStatus.latency === null ? '' : ` · ${apiStatus.latency} MS`}` : apiStatus.state === 'checking' ? 'CHECKING' : 'UNAVAILABLE'}</strong></div>
          <div><span><Activity size={14} /> INVENTORY SEARCH</span><strong>{requestLabel(searchRequest)}</strong></div>
          <div><span><Activity size={14} /> VEHICLE COMPARISON</span><strong>{requestLabel(compareRequest)}</strong></div>
          <p>Health is verified from the live API. Request timings and HTTP status are measured in this browser; vehicle fields marked “Not recorded” are not present in the catalogue.</p>
        </div>
      </details>

      {result && (
        <div className="finder-results" aria-live="polite">
          {result.warning && <div className="finder-provider-warning" role="status">{result.warning}</div>}
          <div className="finder-result-summary">
            <div>
              <p className="eyebrow"><span className="eyebrow-line" /> INTERPRETATION · {result.parser === 'provider' ? 'AI-ASSISTED' : 'BUILT-IN PARSER'}</p>
              <h3>{result.summary}</h3>
            </div>
          </div>
          {result.needsClarification ? (
            <div className="finder-clarification" role="status">{result.clarificationQuestion}</div>
          ) : (
            <>
              {result.criteria?.mustHave?.length > 0 && (
                <div className="finder-criteria">
                  <span>HARD REQUIREMENTS</span>
                  {result.criteria.mustHave.map((criterion) => <span className="finder-criterion" key={criterion}>{criterion}</span>)}
                  {result.criteria.preferences?.map((preference) => (
                    <span className="finder-preference" key={preference}>Priority: {preference.replaceAll('_', ' ')}</span>
                  ))}
                  {result.criteria.excluded?.map((constraint) => <span className="finder-criterion" key={constraint}>{constraint}</span>)}
                </div>
              )}
              {result.matches.length > 0 && (
                <>
                  <div className="finder-results-header">
                    <h3>Exact matches <span>{result.matches.length}</span></h3>
                    <span>Ranked by recorded specifications and your stated priorities.</span>
                  </div>
                  <div className="finder-grid">{result.matches.map(recommendationCard)}</div>
                </>
              )}
              {result.alternatives.length > 0 && (
                <>
                  <div className="finder-results-header alternatives-heading">
                    <h3>No exact match <span>Consider relaxing one filter</span></h3>
                    <span>Each option relaxes only its labeled requirement; other hard constraints stay applied.</span>
                  </div>
                  <div className="finder-grid">{result.alternatives.map(recommendationCard)}</div>
                </>
              )}
              {!result.matches.length && !result.alternatives.length && (
                <div className="finder-clarification" role="status">
                  No available inventory matches these interpreted requirements. Try a different budget, category, or specification.
                </div>
              )}
            </>
          )}

        </div>
      )}

      {comparison && (
        <div className="finder-comparison" id="comparison" aria-live="polite">
          <div className="finder-results-header">
            <h3>Side-by-side <span>comparison</span></h3>
            <button className="finder-secondary" type="button" onClick={() => setComparison(null)}>Close comparison</button>
          </div>
          <p className="finder-comparison-summary">{comparison.summary}</p>
          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <thead><tr><th scope="col">Specification</th>{comparison.vehicles.map((vehicle) => <th scope="col" key={vehicle.id}>{vehicle.make} {vehicle.model}</th>)}</tr></thead>
              <tbody>
                {comparison.rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.label}</th>
                    {row.values.map((value, index) => (
                      <td key={`${row.key}-${comparison.vehicles[index].id}`}>
                        {row.key === 'price' ? money(value) : value === null ? 'Not recorded' : String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="comparison-footnote">Only specifications recorded in the current catalogue are compared. No overall winner is assumed.</p>
        </div>
      )}

      {details && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetails(null); }}>
          <div className="finder-details" ref={detailsDialogRef} role="dialog" aria-modal="true" aria-labelledby="finder-details-title" tabIndex="-1">
            <div className="editor-header">
              <p className="eyebrow"><span className="eyebrow-line" /> CURRENT CATALOGUE DATA</p>
              <button className="icon-button" type="button" aria-label="Close vehicle details" onClick={() => setDetails(null)}><X size={19} /></button>
            </div>
            <h3 id="finder-details-title">{details.vehicle.make} {details.vehicle.model}</h3>
            <p className="finder-price">{money(details.vehicle.price)}</p>
            <dl className="finder-spec-list">
              {Object.entries(details.vehicle.specifications || {}).map(([key, value]) => (
                <div key={key}><dt>{key.replace(/([A-Z])/g, ' $1').replaceAll('_', ' ')}</dt><dd>{value === null ? 'Not recorded' : String(value)}</dd></div>
              ))}
            </dl>
            {details.tradeOffs?.map((tradeOff) => <p className="finder-detail-note" key={tradeOff}>{tradeOff}</p>)}
            <button
              className="finder-submit"
              type="button"
              disabled={details.vehicle.quantity < 1}
              onClick={() => purchaseRecommendation(details.vehicle)}
            >
              {details.vehicle.quantity < 1 ? 'Sold out' : 'Purchase'}
            </button>
          </div>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="compare-dock" role="region" aria-label="Vehicle comparison selection">
          <div className="compare-dock-copy">
            <span>{selectedIds.length}/3 SELECTED</span>
            <strong>{selectedVehicles.join(' · ') || 'Select another vehicle to compare'}</strong>
          </div>
          <button type="button" disabled={selectedIds.length < 2 || comparing} onClick={compareSelected}>
            {comparing ? 'Comparing…' : `Compare ${selectedIds.length} vehicles`}
            <ArrowUpRight size={16} />
          </button>
        </div>
      )}
    </section>
  );
}

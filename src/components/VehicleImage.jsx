import React, { useState } from 'react';
import { CarFront } from 'lucide-react';

function toneFor(seed = '') {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 4;
}

/** Vehicle photo with a clean branded fallback when there is no image or it fails to load. */
export function VehicleImage({ vehicle, className = 'vehicle-media', iconSize = 72, children, alt = '' }) {
  const [failed, setFailed] = useState(false);
  const showImage = vehicle?.imageUrl && !failed;
  const tone = toneFor(`${vehicle?.make}${vehicle?.model}`);
  return (
    <div className={`${className} ${showImage ? '' : `vehicle-media-tone-${tone}`}`}>
      {showImage ? (
        <img src={vehicle.imageUrl} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        <div className="vehicle-media-fallback" aria-hidden="true">
          <CarFront size={iconSize} strokeWidth={1.1} />
          {vehicle?.make && <span>{vehicle.make}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

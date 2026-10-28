export function stockBadge(vehicle) {
  if (vehicle.status === 'unlisted') return { label: 'Hidden', tone: 'badge' };
  if (vehicle.quantity < 1) return { label: 'Sold out', tone: 'badge badge-danger' };
  if (vehicle.quantity <= 2) return { label: `Only ${vehicle.quantity} left`, tone: 'badge badge-warning' };
  return { label: 'In stock', tone: 'badge badge-success' };
}

export function titleCase(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const RELAXED_LABELS = {
  maxPrice: 'slightly over budget',
  minPrice: 'below your minimum price',
  category: 'different body style',
  fuelType: 'different fuel type',
  transmission: 'different transmission',
  minSeatingCapacity: 'fewer seats',
  minMileage: 'lower mileage',
  minRange: 'shorter range',
  minGroundClearance: 'lower ground clearance',
};

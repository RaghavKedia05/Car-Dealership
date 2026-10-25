ALTER TABLE vehicles ADD COLUMN body_type TEXT;
ALTER TABLE vehicles ADD COLUMN vehicle_year INTEGER
  CHECK (vehicle_year IS NULL OR vehicle_year BETWEEN 1886 AND 2100);
ALTER TABLE vehicles ADD COLUMN fuel_type TEXT
  CHECK (fuel_type IS NULL OR fuel_type IN ('petrol', 'diesel', 'electric', 'hybrid', 'cng', 'lpg'));
ALTER TABLE vehicles ADD COLUMN transmission TEXT
  CHECK (transmission IS NULL OR transmission IN ('automatic', 'manual'));
ALTER TABLE vehicles ADD COLUMN seating_capacity INTEGER
  CHECK (seating_capacity IS NULL OR seating_capacity BETWEEN 1 AND 20);
ALTER TABLE vehicles ADD COLUMN mileage_kmpl REAL
  CHECK (mileage_kmpl IS NULL OR mileage_kmpl > 0);
ALTER TABLE vehicles ADD COLUMN electric_range_km REAL
  CHECK (electric_range_km IS NULL OR electric_range_km > 0);
ALTER TABLE vehicles ADD COLUMN engine_capacity_cc INTEGER
  CHECK (engine_capacity_cc IS NULL OR engine_capacity_cc > 0);
ALTER TABLE vehicles ADD COLUMN ground_clearance_mm INTEGER
  CHECK (ground_clearance_mm IS NULL OR ground_clearance_mm > 0);
ALTER TABLE vehicles ADD COLUMN safety_features TEXT;

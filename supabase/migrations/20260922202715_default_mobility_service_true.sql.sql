/*
# Make mobility service the default for all companies
- Change column default to true
- Update all existing companies to has_mobility_service = true
*/
ALTER TABLE companies ALTER COLUMN has_mobility_service SET DEFAULT true;
UPDATE companies SET has_mobility_service = true WHERE has_mobility_service = false;

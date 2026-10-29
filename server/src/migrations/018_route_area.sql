-- The area of law a route belongs to. It is the same list as the guides use. It lets the Where
-- to Go page filter on a checked fact. It is part of the route, so the integrity rule covers it:
-- any edit sends the route back to draft and only an admin publishes it again.
-- A route that already exists has no area until an admin sets one and checks it again.
ALTER TABLE matter_routes ADD COLUMN area TEXT
  CHECK (area IS NULL OR area IN ('tenancy', 'employment', 'business', 'immigration', 'harassment', 'vehicles'));

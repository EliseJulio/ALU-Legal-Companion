-- The "how to do it" part of a guide. It holds the service link (such as Irembo) and its help
-- article link, who can apply, the fees, the documents, the offices and the steps.
-- A step can link to the page where it happens. There are no screenshots.
-- It is one column on the guide row. So the integrity rule covers it with nothing extra.
-- Any edit sends the guide back to draft. Only an admin publishes it again.
ALTER TABLE guides ADD COLUMN service JSONB;

-- A sixth area of law. Buying a car and the driving licence.
ALTER TABLE guides DROP CONSTRAINT guides_domain_check;
ALTER TABLE guides ADD CONSTRAINT guides_domain_check
  CHECK (domain IN ('tenancy', 'employment', 'business', 'immigration', 'harassment', 'vehicles'));

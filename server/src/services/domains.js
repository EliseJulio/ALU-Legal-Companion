// The areas of law. Guides and routes both belong to one of them. The database has the same list
// in two CHECK rules (guides.domain and matter_routes.area). The client has a filter button for
// each one. A test compares this list with the two rules so they cannot drift apart.
export const DOMAINS = ['tenancy', 'employment', 'business', 'immigration', 'harassment', 'vehicles'];

// A value typed by a person or sent by a link. Spaces and capitals do not matter. Anything that is
// not text becomes an empty string, which no area matches.
export const normalizeDomain = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

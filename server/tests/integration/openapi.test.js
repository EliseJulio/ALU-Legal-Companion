import request from 'supertest';
import app from '../../src/app.js';
import { openapi, documentedRoutes } from '../../src/openapi.js';

// Walks the routers of the app and lists every route as "METHOD /path".
// Express 4 keeps the mount path of a router only as a regular expression. This turns it back
// into a path such as /api/matters/:matterId/documents.
function mountPath(layer) {
  let source = layer.regexp.source.replace('^', '').replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/');
  let i = 0;
  source = source.replace(/\(\?:\/\(\[\^\/\]\+\?\)\)/g, () => `/:${layer.keys[i++].name}`);
  return source;
}

function serverRoutes() {
  const found = [];
  const walk = (stack, prefix) => {
    for (const layer of stack) {
      if (layer.route) {
        for (const method of Object.keys(layer.route.methods)) {
          const path = layer.route.path === '/' ? '' : layer.route.path;
          found.push(`${method.toUpperCase()} ${prefix}${path}`);
        }
      } else if (layer.name === 'router' && layer.handle.stack) {
        walk(layer.handle.stack, prefix + mountPath(layer));
      }
    }
  };
  walk(app._router.stack, '');
  // The two routes that serve the description itself are not part of what it describes.
  return found.filter((r) => !r.includes('/api/openapi.json') && !r.includes('/api/docs'));
}

const documented = () => documentedRoutes.map((r) => r.replace(/\{(\w+)\}/g, ':$1').replace(' /', ' /api/'));

describe('the API description', () => {
  it('describes every route the server has', () => {
    const have = new Set(documented());
    const missing = serverRoutes().filter((r) => !have.has(r));
    expect(missing).toEqual([]);
  });

  it('describes no route the server does not have', () => {
    const have = new Set(serverRoutes());
    const extra = documented().filter((r) => !have.has(r));
    expect(extra).toEqual([]);
  });

  it('gives each route a summary, a known tag and at least one answer', () => {
    const tags = new Set(openapi.tags.map((t) => t.name));
    for (const [path, methods] of Object.entries(openapi.paths)) {
      for (const [method, op] of Object.entries(methods)) {
        const where = `${method.toUpperCase()} ${path}`;
        expect(`${where} ${op.summary ? 'has a summary' : 'has no summary'}`).toMatch(/has a summary/);
        expect(`${where} ${tags.has(op.tags[0]) ? 'has a known tag' : 'has an unknown tag'}`).toMatch(/has a known tag/);
        expect(Object.keys(op.responses).length).toBeGreaterThan(0);
      }
    }
  });

  it('points every reference at a shape that exists', () => {
    const names = new Set(Object.keys(openapi.components.schemas));
    const used = [...JSON.stringify(openapi).matchAll(/#\/components\/schemas\/(\w+)/g)].map((m) => m[1]);
    expect(used.filter((n) => !names.has(n))).toEqual([]);
  });

  it('says which routes need a sign-in and which do not', () => {
    for (const [path, methods] of Object.entries(openapi.paths)) {
      for (const [method, op] of Object.entries(methods)) {
        const where = `${method.toUpperCase()} ${path}`;
        const protectedRoute = op['x-roles'] !== 'public';
        expect([where, Boolean(op.security)]).toEqual([where, protectedRoute]);
        // A route that needs a sign-in must say it can answer 401. A public one may too, like login.
        if (protectedRoute) expect([where, '401' in op.responses]).toEqual([where, true]);
      }
    }
  });

  it('keeps the admin-only routes admin only', () => {
    const adminOnly = ['POST /api/guides/:id/publish', 'POST /api/checklists/:id/publish', 'POST /api/directory/routes/:id/publish', 'GET /api/admin/stats'];
    for (const route of adminOnly) {
      const [method, path] = route.split(' ');
      const op = openapi.paths[path.replace('/api', '').replace(/:(\w+)/g, '{$1}')][method.toLowerCase()];
      expect([route, op['x-roles']]).toEqual([route, ['admin']]);
    }
  });
});

describe('the API pages', () => {
  it('serves the raw description with no sign-in', async () => {
    const res = await request(app).get('/api/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\.0\./);
    expect(Object.keys(res.body.paths).length).toBeGreaterThan(50);
  });

  it('serves the Swagger page with no sign-in and loads nothing from another site', async () => {
    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toMatch(/swagger-ui/i);
    expect(res.text).not.toMatch(/(src|href)=["']https?:\/\//i);
  });
});

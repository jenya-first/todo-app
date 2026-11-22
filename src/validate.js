export class ValidationError extends Error {}

const RUN_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(msg) {
  throw new ValidationError(msg);
}

function plainObject(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    fail('Body must be a JSON object');
  }
  return body;
}

function onlyKeys(body, allowed) {
  const extra = Object.keys(body).filter((k) => !allowed.includes(k));
  if (extra.length) fail(`Unexpected fields: ${extra.join(', ')}`);
}

export function title(v) {
  if (typeof v !== 'string') fail('title must be a string');
  const t = v.trim();
  if (t.length < 1 || t.length > 200) fail('title must be 1-200 characters after trim');
  return t;
}

export function runId(v) {
  if (typeof v !== 'string' || !RUN_ID_RE.test(v)) {
    fail('runId must be 1-64 characters of A-Z, a-z, 0-9, _ or -');
  }
  return v;
}

export function uuid(v) {
  if (typeof v !== 'string' || !UUID_RE.test(v)) fail('Invalid task id');
  return v.toLowerCase();
}

export function createBody(body) {
  plainObject(body);
  onlyKeys(body, ['title', 'runId']);
  return { title: title(body.title), runId: runId(body.runId) };
}

export function patchBody(body) {
  plainObject(body);
  onlyKeys(body, ['title', 'done']);
  const out = {};
  if ('title' in body) out.title = title(body.title);
  if ('done' in body) {
    if (typeof body.done !== 'boolean') fail('done must be a boolean');
    out.done = body.done;
  }
  if (!Object.keys(out).length) fail('Provide title and/or done');
  return out;
}

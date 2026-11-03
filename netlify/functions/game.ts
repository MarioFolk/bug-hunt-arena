import { getStore } from '@netlify/blobs';
import { applyAction, emptyState } from '../lib/game-engine.mjs';

const STORE_NAME = 'bug-hunt-arena-state';
const STATE_KEY = 'global-state-v1';
const MAX_ATTEMPTS = 12;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

async function execute(body: unknown) {
  const store = getStore(STORE_NAME);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const entry = await store.getWithMetadata(STATE_KEY, {
      consistency: 'strong',
      type: 'json'
    });
    const state = entry?.data ?? emptyState();
    const { result, changed } = applyAction(state, body, Date.now());

    if (!changed) return result;

    const write = entry?.etag
      ? await store.setJSON(STATE_KEY, state, { onlyIfMatch: entry.etag })
      : await store.setJSON(STATE_KEY, state, { onlyIfNew: true });

    if (write.modified) return result;
  }
  throw new Error('The game state is busy. Please retry your action.');
}

export default async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' } });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const raw = await request.text();
    if (raw.length > 16_384) return json({ error: 'Request is too large.' }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); }
    catch { return json({ error: 'Invalid JSON request.' }, 400); }
    const result = await execute(body);
    return json(result);
  } catch (error) {
    console.error('Bug Hunt Arena function error:', error);
    return json({ error: 'The arena is temporarily unavailable. Please try again.' }, 503);
  }
};

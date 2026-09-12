import { jsonHeaders, getUserId, jsonResponse, errorResponse, corsHeaders } from '../_utils';

export async function onRequestGet(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = getUserId(request);
    const data = {};
    const keys = ['schedule', 'accounting'];

    for (const key of keys) {
      const raw = await env.WORKBENCH_KV.get(userId + ':' + key);
      data[key] = raw ? JSON.parse(raw) : [];
    }

    return jsonResponse({ ok: true, data });
  } catch (err) {
    return errorResponse(err.message);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = getUserId(request);
    const body = await request.json();

    const results = {};
    const keys = ['schedule', 'accounting'];

    for (const key of keys) {
      if (body[key] !== undefined) {
        await env.WORKBENCH_KV.put(userId + ':' + key, JSON.stringify(body[key]));
        results[key] = 'ok';
      }
    }

    return jsonResponse({ ok: true, saved: results, syncedAt: new Date().toISOString() });
  } catch (err) {
    return errorResponse(err.message);
  }
}

import { jsonResponse, errorResponse, corsHeaders, translateWithAI } from '../_utils';

export async function onRequestPost(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const text = (body.text || '').slice(0, 800);
    if (!text) {
      return errorResponse('missing text', 400);
    }
    const translated = await translateWithAI(env, text);
    return jsonResponse({ ok: true, translated });
  } catch (err) {
    return errorResponse(err.message);
  }
}

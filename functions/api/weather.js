import { jsonResponse, errorResponse, corsHeaders } from '../_utils';

export async function onRequestGet(context) {
  const { request, env, waitUntil } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(request.url);
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');

  const apiKey = env.QWEATHER_API_KEY;

  if (!apiKey) {
    return jsonResponse({
      ok: false,
      error: '未配置和风天气 API Key',
      fallback: { city: '未配置', text: '未知', temp: '--', wind: '' },
    });
  }

  if (!lat || !lon) {
    return errorResponse('缺少 lat/lon 参数', 400);
  }

  try {
    // 缓存
    const cacheKey = 'cache:weather:' + lat + ':' + lon;
    const cached = await env.WORKBENCH_KV.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      if (Date.now() - data.fetchedAt < 1800000) {
        return jsonResponse({ ok: true, ...data, cached: true });
      }
    }

    const apiHost = env.QWEATHER_API_HOST || 'devapi.qweather.com';
    const weatherUrl = 'https://' + apiHost + '/weather/v1/current/' + lat + '/' + lon + '?key=' + apiKey;
    const wRes = await fetch(weatherUrl);
    const wJson = await wRes.json();

    const fallback = { city: '获取失败', text: '未知', temp: '--', wind: '' };

    if (wJson.code !== '200' || !wJson.now) {
      return jsonResponse({ ok: false, error: '天气获取失败 code=' + (wJson.code || 'unknown'), raw: wJson, fallback });
    }

    const now = wJson.now;
    const data = {
      city: wJson.cityName || '当前位置',
      text: now.text || '未知',
      temp: now.temp + '°C',
      wind: (now.windDir || '') + '风 ' + (now.windScale || '') + '级',
      humidity: now.humidity ? now.humidity + '%' : '',
      feelsLike: now.feelsLike ? now.feelsLike + '°C' : '',
      updatedAt: new Date().toISOString(),
      fetchedAt: Date.now(),
    };

    waitUntil(env.WORKBENCH_KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 1800 }));

    return jsonResponse({ ok: true, ...data });
  } catch (err) {
    return errorResponse('天气获取失败: ' + err.message);
  }
}

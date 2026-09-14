import { jsonResponse, errorResponse, corsHeaders } from '../_utils';

export async function onRequestGet(context) {
  const { request, env, waitUntil } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(request.url);
  let lat = url.searchParams.get('lat');
  let lon = url.searchParams.get('lon');

  const apiKey = env.QWEATHER_API_KEY;

  if (!apiKey) {
    return jsonResponse({
      ok: false,
      error: '未配置和风天气 API Key',
      fallback: { city: '未配置', text: '未知', temp: '--', wind: '' },
    });
  }

  // IP-based fallback: use Cloudflare CF object if no coordinates
  if ((!lat || !lon) && request.cf) {
    lat = request.cf.latitude;
    lon = request.cf.longitude;
  }

  if (!lat || !lon) {
    return errorResponse('缺少 lat/lon 参数且无法通过 IP 定位', 400);
  }

  // Round to 2 decimal places for better cache hits
  lat = parseFloat(lat).toFixed(2);
  lon = parseFloat(lon).toFixed(2);

  try {
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

    if (!wJson || !wJson.condition) {
      return jsonResponse({ ok: false, error: '天气获取失败', fallback });
    }

    const now = wJson;
    const data = {
      city: wJson.cityName || '当前位置',
      text: now.condition ? (now.condition.text || '未知') : '未知',
      temp: now.temperature ? now.temperature.value + '°C' : '--',
      wind: now.wind && now.wind.direction
        ? (now.wind.direction.compass || '') + '风 ' + (now.wind.scale || '') + '级'
        : '',
      humidity: now.humidity ? Math.round(now.humidity * 100) + '%' : '',
      feelsLike: now.feelsLike ? now.feelsLike.value + '°C' : '',
      updatedAt: new Date().toISOString(),
      fetchedAt: Date.now(),
    };

    waitUntil(env.WORKBENCH_KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 1800 }));

    return jsonResponse({ ok: true, ...data });
  } catch (err) {
    return errorResponse('天气获取失败: ' + err.message);
  }
}

/**
 * 天气模块 - 自动定位 + 和风天气 API
 * 前端先调 navigator.geolocation 获取坐标
 * 再通过 Pages Functions 代理调和风天气 API
 */
const WeatherModule = (function () {

  const WEATHER_ICONS = {
    '晴': '☀️',
    '多云': '⛅',
    '阴': '☁️',
    '小雨': '🌦️',
    '中雨': '🌧️',
    '大雨': '🌧️',
    '暴雨': '⛈️',
    '雷阵雨': '⛈️',
    '雪': '🌨️',
    '雾': '🌫️',
    '霾': '😷',
  };

  function getApiBase() {
    return localStorage.getItem('apiBase') || '';
  }

  function getIcon(text) {
    for (const key in WEATHER_ICONS) {
      if (text && text.indexOf(key) !== -1) return WEATHER_ICONS[key];
    }
    return '🌤️';
  }

  function init() {
    fetchWeather();
  }

  async function fetchWeather() {
    const card = document.querySelector('#view-settings .weather-card');
    if (!card) return;

    card.innerHTML =
      '<span class="weather-icon">📍</span>' +
      '<div class="weather-info"><div class="weather-city">定位中...</div>' +
      '<div class="weather-desc">请稍候</div></div>';

    // 尝试定位
    let location = null;
    try {
      location = await getPosition();
    } catch (e) {
      renderWeather(card, null, '定位失败，请检查权限');
      return;
    }

    // 调 API
    try {
      const apiBase = getApiBase();
      const url = apiBase + '/api/weather?lat=' + location.lat + '&lon=' + location.lon;
      const res = await fetch(url, {
        headers: { 'X-User-Id': getUserId() },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok !== false && data.text) {
          renderWeather(card, data, null);
          return;
        }
        if (data.fallback) {
          renderWeather(card, data.fallback, null);
          return;
        }
        if (data.error) {
          renderWeather(card, { city: '获取失败', text: data.error, temp: '--', wind: '' }, null);
          return;
        }
      }
    } catch (e) {
      renderWeather(card, { city: '网络异常', text: '点击重试', temp: '--', wind: e.message || '' }, null);
      card.style.cursor = 'pointer';
      card.onclick = () => fetchWeather();
      return;
    }

    // 兜底
    renderWeather(card, {
      city: '获取失败',
      text: '点击重试',
      temp: '--',
      wind: '',
    }, null);
    card.style.cursor = 'pointer';
    card.onclick = () => fetchWeather();
  }

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('不支持定位'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude.toFixed(2), lon: pos.coords.longitude.toFixed(2) }),
        (err) => reject(err),
        { timeout: 8000, enableHighAccuracy: false }
      );
    });
  }

  function renderWeather(card, data, error) {
    if (error) {
      card.innerHTML =
        '<span class="weather-icon">📍</span>' +
        '<div class="weather-info"><div class="weather-city">' + error + '</div>' +
        '<div class="weather-desc">点击重试</div></div>';
      card.style.cursor = 'pointer';
      card.onclick = () => fetchWeather();
      return;
    }

    card.innerHTML =
      '<span class="weather-icon">' + getIcon(data.text) + '</span>' +
      '<div class="weather-info">' +
      '<div class="weather-city">' + escapeHtml(data.city) + '</div>' +
      '<div class="weather-desc">' + escapeHtml(data.text) + (data.wind ? ' · ' + escapeHtml(data.wind) : '') + '</div>' +
      '</div>' +
      '<div class="weather-temp">' + (data.temp || '--') + '</div>';
    card.style.cursor = 'default';
    card.onclick = null;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function getUserId() {
    return localStorage.getItem('userId') || 'default';
  }

  return { init, fetchWeather };
})();

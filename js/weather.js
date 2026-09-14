/**
 * 天气模块 - 自动定位 + 和风天气 API
 * 前端先调 navigator.geolocation 获取坐标
 * 定位失败时自动回退到 IP 定位
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

  function bindRetry(card) {
    card.onclick = null;
    card.addEventListener('click', handleRetry);
  }

  function handleRetry() {
    fetchWeather();
  }

  async function fetchWeather() {
    const card = document.querySelector('#view-settings .weather-card');
    if (!card) return;

    // Remove previous retry listener
    card.removeEventListener('click', handleRetry);

    card.innerHTML =
      '<span class="weather-icon">📍</span>' +
      '<div class="weather-info"><div class="weather-city">定位中...</div>' +
      '<div class="weather-desc">请稍候</div></div>';

    // 尝试 GPS 定位
    let location = null;
    let gpsFailed = false;

    try {
      location = await getPosition();
    } catch (e) {
      gpsFailed = true;
    }

    // GPS 失败时回退到 IP 定位
    try {
      const apiBase = getApiBase();
      let url;
      if (location) {
        url = apiBase + '/api/weather?lat=' + location.lat + '&lon=' + location.lon;
      } else {
        // 不传坐标，后端通过 Cloudflare CF 对象 IP 定位
        url = apiBase + '/api/weather';
      }
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
      renderError(card, '网络异常', e.message || '');
      return;
    }

    // 兜底
    renderError(card, '获取失败', '');
  }

  function renderError(card, title, desc) {
    card.innerHTML =
      '<span class="weather-icon">📍</span>' +
      '<div class="weather-info">' +
      '<div class="weather-city">' + escapeHtml(title) + '</div>' +
      '<div class="weather-desc">' + (desc ? escapeHtml(desc) + ' · ' : '') + '点击重试</div>' +
      '</div>';
    card.style.cursor = 'pointer';
    bindRetry(card);
  }

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('不支持定位'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          lat: pos.coords.latitude.toFixed(2),
          lon: pos.coords.longitude.toFixed(2),
        }),
        (err) => reject(err),
        { timeout: 10000, enableHighAccuracy: false, maximumAge: 300000 }
      );
    });
  }

  function renderWeather(card, data, error) {
    card.innerHTML =
      '<span class="weather-icon">' + getIcon(data.text) + '</span>' +
      '<div class="weather-info">' +
      '<div class="weather-city">' + escapeHtml(data.city) + '</div>' +
      '<div class="weather-desc">' + escapeHtml(data.text) + (data.wind ? ' · ' + escapeHtml(data.wind) : '') + '</div>' +
      '</div>' +
      '<div class="weather-temp">' + (data.temp || '--') + '</div>';
    card.style.cursor = 'default';
    card.removeEventListener('click', handleRetry);
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

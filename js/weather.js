// Live forecast for the anchorage from Open-Meteo (free, no key). Cached for 30 minutes.
const WMO = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Cloudy', 45: 'Fog', 48: 'Fog',
  51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Snow', 73: 'Snow', 75: 'Snow', 80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
  95: 'Thunderstorms', 96: 'Thunderstorms', 99: 'Thunderstorms'
};
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function compass(deg) {
  return Number.isFinite(deg) ? DIRS[Math.round(deg / 45) % 8] : '';
}

export async function getWeather(lat, lon) {
  const key = `delusha:wx:${lat.toFixed(2)},${lon.toFixed(2)}`;
  try {
    const c = JSON.parse(localStorage.getItem(key) || 'null');
    if (c && Date.now() - c.at < 30 * 60 * 1000) return c.data;
  } catch {
    /* ignore */
  }
  try {
    const [f, m] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m&daily=sunset&wind_speed_unit=kn&timezone=auto&forecast_days=1`).then((r) => r.json()),
      fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,sea_surface_temperature&timezone=auto`).then((r) => r.json()).catch(() => null)
    ]);
    const data = {
      air: Math.round(f.current.temperature_2m),
      sky: WMO[f.current.weather_code] || '',
      wind: Math.round(f.current.wind_speed_10m),
      windDir: compass(f.current.wind_direction_10m),
      sunset: f.daily?.sunset?.[0]?.slice(11, 16) || '',
      sea: Number.isFinite(m?.current?.sea_surface_temperature) ? Math.round(m.current.sea_surface_temperature) : null,
      waves: Number.isFinite(m?.current?.wave_height) ? m.current.wave_height.toFixed(1) : null
    };
    try {
      localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
    } catch {
      /* ignore */
    }
    return data;
  } catch {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null')?.data || null;
    } catch {
      return null;
    }
  }
}

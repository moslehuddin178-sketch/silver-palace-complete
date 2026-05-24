import { useState, useEffect } from 'react';
import { Spinner } from './index';

// ── Weather condition → emoji ─────────────────────────────────────────────────
const ICONS = {
  Clear:        '☀️',
  Clouds:       '☁️',
  Rain:         '🌧️',
  Drizzle:      '🌦️',
  Thunderstorm: '⛈️',
  Snow:         '❄️',
  Mist:         '🌫️',
  Fog:          '🌫️',
  Haze:         '🌫️',
  Smoke:        '🌫️',
  Dust:         '🌪️',
  Sand:         '🌪️',
  Tornado:      '🌪️',
};

const getIcon = (condition) => ICONS[condition] || '🌡️';

// ── Wind direction from degrees ───────────────────────────────────────────────
const windDir = (deg) => {
  if (deg === undefined) return '';
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
};

// ── Business tip based on weather ────────────────────────────────────────────
const getBusinessTip = (data) => {
  if (!data) return null;
  const { condition, temperature, humidity } = data;
  if (condition === 'Rain' || condition === 'Thunderstorm' || condition === 'Drizzle')
    return { icon: '💡', text: 'Rainy day — great for online wholesale orders', color: 'text-blue-600 bg-blue-50 border-blue-100' };
  if (condition === 'Snow')
    return { icon: '❄️', text: 'Cold weather — push indoor gift collections', color: 'text-indigo-600 bg-indigo-50 border-indigo-100' };
  if (temperature >= 30)
    return { icon: '☀️', text: 'Hot day — expect walk-in retail traffic', color: 'text-amber-600 bg-amber-50 border-amber-100' };
  if (temperature <= 5)
    return { icon: '🧥', text: 'Very cold — highlight warm-toned pieces', color: 'text-blue-600 bg-blue-50 border-blue-100' };
  if (condition === 'Clear' && temperature >= 15 && temperature <= 28)
    return { icon: '🛍️', text: 'Perfect weather — expect good foot traffic', color: 'text-green-600 bg-green-50 border-green-100' };
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPACT variant — used in Topbar
// ─────────────────────────────────────────────────────────────────────────────
export function WeatherTicker({ city }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sp_token');
    const url   = `/api/weather${city ? `?city=${encodeURIComponent(city)}` : ''}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(r => { if (r.success) setData(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [city]);

  if (loading) return <div className="w-24 h-7 bg-gray-100 rounded-lg animate-pulse" />;
  if (!data)   return null;

  return (
    <div className="flex items-center gap-1.5 bg-sky-50 border border-sky-200 rounded-lg px-3 py-1.5" title={data.description}>
      <span className="text-sm">{getIcon(data.condition)}</span>
      <span className="text-xs font-semibold text-sky-700">{data.city}</span>
      <span className="text-xs text-sky-600">{data.temperature}°C</span>
      <span className="text-xs text-sky-400 capitalize hidden xl:inline">{data.description}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL CARD variant — used in Dashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function WeatherWidget({ city }) {
  const [data, setData]         = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [cityInput, setCityInput] = useState(city || '');
  const [currentCity, setCurrentCity] = useState(city || '');

  const load = (c) => {
    setLoading(true); setError('');
    const token = localStorage.getItem('sp_token');
    const q     = c ? `?city=${encodeURIComponent(c)}` : '';

    Promise.all([
      fetch(`/api/weather${q}`,          { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/weather/forecast${q}`, { headers: { Authorization: `Bearer ${token}` } }),
    ])
      .then(([r1, r2]) => Promise.all([r1.json(), r2.json()]))
      .then(([w, f]) => {
        if (w.success)  setData(w.data);
        else            setError(w.message || 'Failed to load weather');
        if (f.success)  setForecast(f.forecast || []);
      })
      .catch(() => setError('Could not connect to weather service'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(currentCity); }, [currentCity]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (cityInput.trim()) setCurrentCity(cityInput.trim());
  };

  const tip = getBusinessTip(data);

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-500 to-blue-600 p-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌤</span>
            <span className="font-semibold text-sm">Weather</span>
          </div>
          {data && (
            <span className="text-xs text-white/60">
              Updated {new Date(data.updatedAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
            </span>
          )}
        </div>

        {/* City search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={cityInput}
            onChange={e => setCityInput(e.target.value)}
            placeholder="Search city…"
            className="flex-1 bg-white/20 placeholder-white/60 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:bg-white/30 border border-white/20"
          />
          <button type="submit"
            className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 rounded-lg border border-white/20 transition-colors">
            Search
          </button>
        </form>
      </div>

      <div className="p-4">
        {/* Loading */}
        {loading && (
          <div className="flex justify-center items-center py-8">
            <Spinner size="lg" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-6">
            <p className="text-3xl mb-2">⚠️</p>
            <p className="text-red-500 text-sm font-medium">{error}</p>
            <button onClick={() => load(currentCity)}
              className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline">
              Try again
            </button>
          </div>
        )}

        {/* Main weather data */}
        {!loading && data && !error && (
          <div className="space-y-4">
            {/* Current conditions */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-bold text-gray-900">{data.temperature}°</span>
                  <span className="text-lg text-gray-400 mb-1">C</span>
                </div>
                <p className="text-gray-500 text-sm capitalize mt-0.5">{data.description}</p>
                <p className="text-gray-400 text-xs mt-0.5">Feels like {data.feelsLike}°C</p>
                <p className="font-semibold text-gray-800 mt-2">
                  {data.city}, <span className="font-normal text-gray-400">{data.country}</span>
                </p>
              </div>
              <div className="text-right">
                <span className="text-6xl">{getIcon(data.condition)}</span>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon:'💧', label:'Humidity',    value:`${data.humidity}%`           },
                { icon:'💨', label:'Wind',         value:`${data.windSpeed} m/s ${windDir(data.windDeg)}` },
                { icon:'👁️', label:'Visibility',  value: data.visibility ? `${data.visibility} km` : '—' },
                { icon:'🌡️', label:'Pressure',    value:`${data.pressure} hPa`        },
                { icon:'🌅', label:'Sunrise',      value: data.sunrise                 },
                { icon:'🌇', label:'Sunset',       value: data.sunset                  },
              ].map(({ icon, label, value }) => (
                <div key={label} className="bg-gray-50 rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <span className="text-base">{icon}</span>
                  <div>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="text-sm font-semibold text-gray-800">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Business tip */}
            {tip && (
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm ${tip.color}`}>
                <span>{tip.icon}</span>
                <span className="font-medium">{tip.text}</span>
              </div>
            )}

            {/* 24h forecast */}
            {forecast.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">24h Forecast</p>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {forecast.slice(0, 8).map((f, i) => (
                    <div key={i} className="flex-shrink-0 flex flex-col items-center gap-1 bg-gray-50 rounded-xl px-3 py-2 min-w-[56px]">
                      <p className="text-xs text-gray-400">
                        {new Date(f.time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                      </p>
                      <span className="text-lg">{getIcon(f.condition)}</span>
                      <p className="text-sm font-semibold text-gray-800">{f.temperature}°</p>
                      {f.pop > 0 && (
                        <p className="text-xs text-blue-500">💧{f.pop}%</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Refresh button */}
            <button
              onClick={() => load(currentCity)}
              className="w-full text-xs text-gray-400 hover:text-gray-600 py-1 transition-colors">
              🔄 Refresh
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
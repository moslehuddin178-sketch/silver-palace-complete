const axios = require('axios');

// Simple in-memory cache — avoids burning API calls on every request
const cache = {
  data:      null,
  city:      null,
  expiresAt: null,
};

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const getClient = () => {
  const key = process.env.WEATHER_API_KEY;
  if (!key || key.includes('YOUR_'))
    throw new Error('WEATHER_API_KEY not configured in .env');
  return key;
};

// ── GET CURRENT WEATHER ───────────────────────────────────────────────────────
const getCurrentWeather = async (req, res) => {
  try {
    const apiKey = getClient();
    const city   = req.query.city || process.env.SHOP_CITY || 'Tampere';

    // Return cached data if still fresh and same city
    if (
      cache.data &&
      cache.city === city &&
      cache.expiresAt > Date.now()
    ) {
      return res.status(200).json({
        success: true,
        cached:  true,
        data:    cache.data,
      });
    }

    // Fetch from OpenWeatherMap
    const response = await axios.get(
      'https://api.openweathermap.org/data/2.5/weather',
      {
        params: {
          q:     city,
          appid: apiKey,
          units: 'metric',  // Celsius — change to 'imperial' for Fahrenheit
        },
        timeout: 8000,
      }
    );

    const d = response.data;

    const formatted = {
      city:        d.name,
      country:     d.sys.country,
      temperature: Math.round(d.main.temp),
      feelsLike:   Math.round(d.main.feels_like),
      humidity:    d.main.humidity,
      pressure:    d.main.pressure,
      windSpeed:   d.wind.speed,
      windDeg:     d.wind.deg,
      condition:   d.weather[0].main,
      description: d.weather[0].description,
      icon:        d.weather[0].icon,
      iconUrl:     `https://openweathermap.org/img/wn/${d.weather[0].icon}@2x.png`,
      visibility:  d.visibility ? Math.round(d.visibility / 1000) : null, // km
      clouds:      d.clouds?.all,
      sunrise:     new Date(d.sys.sunrise * 1000).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' }),
      sunset:      new Date(d.sys.sunset  * 1000).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' }),
      updatedAt:   new Date().toISOString(),

      // Useful for AI context
      summary: `${d.weather[0].description}, ${Math.round(d.main.temp)}°C, humidity ${d.main.humidity}%, wind ${d.wind.speed} m/s in ${d.name}, ${d.sys.country}`,
    };

    // Update cache
    cache.data      = formatted;
    cache.city      = city;
    cache.expiresAt = Date.now() + CACHE_TTL;

    res.status(200).json({
      success: true,
      cached:  false,
      data:    formatted,
    });
  } catch (err) {
    // OpenWeatherMap error (city not found, bad key, etc.)
    if (err.response) {
      const status  = err.response.status;
      const message =
        status === 401 ? 'Invalid API key. Check WEATHER_API_KEY in .env'  :
        status === 404 ? `City not found: "${req.query.city}"` :
        status === 429 ? 'API rate limit exceeded. Try again later.' :
        'Weather service error';
      return res.status(status).json({ success: false, message });
    }
    // Network / timeout error
    if (err.code === 'ECONNABORTED') {
      return res.status(504).json({ success: false, message: 'Weather API timeout' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET FORECAST (5-day / 3-hour) ─────────────────────────────────────────────
const getForecast = async (req, res) => {
  try {
    const apiKey = getClient();
    const city   = req.query.city || process.env.SHOP_CITY || 'Istanbul';

    const response = await axios.get(
      'https://api.openweathermap.org/data/2.5/forecast',
      {
        params: { q: city, appid: apiKey, units: 'metric', cnt: 8 }, // 8 × 3h = 24h
        timeout: 8000,
      }
    );

    const forecast = response.data.list.map(item => ({
      time:        item.dt_txt,
      temperature: Math.round(item.main.temp),
      condition:   item.weather[0].main,
      description: item.weather[0].description,
      icon:        item.weather[0].icon,
      iconUrl:     `https://openweathermap.org/img/wn/${item.weather[0].icon}.png`,
      humidity:    item.main.humidity,
      windSpeed:   item.wind.speed,
      pop:         Math.round((item.pop || 0) * 100), // precipitation probability %
    }));

    res.status(200).json({
      success:  true,
      city:     response.data.city.name,
      country:  response.data.city.country,
      forecast,
    });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json({
        success: false,
        message: err.response.data?.message || 'Forecast fetch failed',
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── CLEAR CACHE (owner/manager only) ─────────────────────────────────────────
const clearCache = (req, res) => {
  cache.data      = null;
  cache.city      = null;
  cache.expiresAt = null;
  res.status(200).json({ success: true, message: 'Weather cache cleared' });
};

module.exports = { getCurrentWeather, getForecast, clearCache };
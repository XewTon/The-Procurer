const API_KEY = import.meta.env.VITE_OPENWEATHER_KEY as string;
const BASE = "https://api.openweathermap.org/data/2.5";

export interface WeatherData {
  mode: string;
  label: string;
  temp: number;
  humidity: number;
  city: string;
  description: string;
  updatedAt: number;
}

export interface WeatherResult {
  data: WeatherData | null;
  error?: string;
}

/* OpenWeather 天气代码 -> 我们的模式 */
const CODE_MAP: Record<string, string> = {
  "01": "sunny", "02": "cloudy", "03": "cloudy", "04": "cloudy",
  "09": "rain", "10": "rain", "11": "storm", "13": "snow", "50": "fog",
};

const LABEL_MAP: Record<string, string> = {
  sunny: "晴天", cloudy: "多云", rain: "雨天", storm: "雷暴", snow: "大雪", fog: "大雾",
};

export async function fetchWeatherByCity(city: string): Promise<WeatherResult> {
  if (!API_KEY) return { data: null, error: "未配置 OpenWeather API Key" };
  try {
    const res = await fetch(`${BASE}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric&lang=zh_cn`);
    if (!res.ok) {
      if (res.status === 404) return { data: null, error: `未找到城市"${city}"` };
      if (res.status === 401) return { data: null, error: "API Key 无效" };
      return { data: null, error: `API 请求失败 (${res.status})` };
    }
    const data = await res.json();
    return { data: parseWeather(data) };
  } catch {
    return { data: null, error: "网络请求失败，请检查网络连接" };
  }
}

export async function fetchWeatherByCoords(lat: number, lon: number): Promise<WeatherResult> {
  if (!API_KEY) return { data: null, error: "未配置 OpenWeather API Key" };
  try {
    const res = await fetch(`${BASE}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=zh_cn`);
    if (!res.ok) return { data: null, error: `位置天气获取失败 (${res.status})` };
    const data = await res.json();
    return { data: parseWeather(data) };
  } catch {
    return { data: null, error: "网络请求失败" };
  }
}

export function getLocationError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED: return "定位权限被拒绝，请允许浏览器获取位置";
    case err.POSITION_UNAVAILABLE: return "无法获取位置信息";
    case err.TIMEOUT: return "定位超时";
    default: return "定位失败";
  }
}

function parseWeather(data: { weather?: { id: number; description?: string }[]; main?: { temp: number; humidity: number }; name?: string }): WeatherData | null {
  if (!data.weather?.[0] || !data.main) return null;
  const code = String(data.weather[0].id).padStart(3, "0").slice(0, 2);
  const mode = CODE_MAP[code] || "sunny";
  return {
    mode,
    label: LABEL_MAP[mode] || mode,
    temp: Math.round(data.main.temp),
    humidity: data.main.humidity,
    city: data.name || "未知城市",
    description: data.weather[0].description || "",
    updatedAt: Date.now(),
  };
}

export function getModeLabel(mode: string): string {
  return LABEL_MAP[mode] || mode;
}

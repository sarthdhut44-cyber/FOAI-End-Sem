export const ISS_CACHE_KEY = "iss-path-v1";
export const SPEED_CACHE_KEY = "iss-speed-history-v1";
export const NEWS_CACHE_KEY = "news-cache-v1";
export const CHAT_CACHE_KEY = "dashboard-chat-v1";
export const THEME_KEY = "dashboard-theme-v1";
export const NEWS_CACHE_TTL = 15 * 60 * 1000;

export function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function haversineKm(pointA, pointB) {
  if (!pointA || !pointB) return 0;
  const earthRadiusKm = 6371;
  const toRad = (value) => (value * Math.PI) / 180;
  const lonA = pointA.lon ?? pointA.lng;
  const lonB = pointB.lon ?? pointB.lng;
  const dLat = toRad(pointB.lat - pointA.lat);
  const dLon = toRad(lonB - lonA);
  const lat1 = toRad(pointA.lat);
  const lat2 = toRad(pointB.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateSpeed(pos1, pos2, timeDiffSeconds) {
  if (!pos1 || !pos2 || !timeDiffSeconds) return 0;
  return (haversineKm(pos1, pos2) / timeDiffSeconds) * 3600;
}

export function computeSpeedKmh(previous, current) {
  if (!previous || !current || previous.timestamp === current.timestamp) return 0;
  const timeDiffSeconds = Math.abs(current.timestamp - previous.timestamp);
  return calculateSpeed(previous, current, timeDiffSeconds);
}

export function formatDate(value) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

export function fallbackPlaceName(lat, lon) {
  const absLat = Math.abs(lat);
  if (lat > 66.5) return "Arctic Ocean region";
  if (lat < -60) return "Southern Ocean region";
  if (lon > -80 && lon < 20 && lat > -35 && lat < 70) return "Atlantic Ocean / nearby land";
  if (lon >= 20 && lon < 150 && lat > -45 && lat < 35) return "Indian Ocean / nearby land";
  if ((lon >= 150 || lon <= -80) && absLat < 60) return "Pacific Ocean / nearby land";
  return "Remote ocean or sparsely populated region";
}

export function normalizeArticle(article, category, index = 0) {
  return {
    id: article.url || article.id || `${category}-${index}-${article.title}`,
    title: article.title || article.name || "Untitled story",
    source: article.source?.name || article.source || article.newsSite || "Unknown source",
    author: article.author || article.byline || article.creator?.[0] || "Unknown author",
    date: article.publishedAt || article.published_at || article.pubDate || article.date || new Date().toISOString(),
    image:
      article.urlToImage ||
      article.image_url ||
      article.imageUrl ||
      article.image ||
      article.links?.thumbnail?.[0]?.href ||
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    description:
      article.description ||
      article.summary ||
      article.content ||
      article.snippet ||
      "No description was provided by this source.",
    url: article.url || article.link || article.webUrl || "#",
    category
  };
}

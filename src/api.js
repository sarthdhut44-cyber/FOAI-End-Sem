import { fallbackPlaceName, normalizeArticle } from "./utils";

const OPEN_NOTIFY = "http://api.open-notify.org";
const CORS_PROXY = "https://api.allorigins.win/raw?url=";
const ISS_FALLBACK = "https://api.wheretheiss.at/v1/satellites/25544";
const EVENT_REGISTRY_BREAKING = "https://eventregistry.org/api/v1/event/getBreakingEvents";

function estimateIssPosition() {
  const timestamp = Math.floor(Date.now() / 1000);
  const orbitPeriodSeconds = 92.68 * 60;
  const phase = ((timestamp % orbitPeriodSeconds) / orbitPeriodSeconds) * 2 * Math.PI;
  const lon = ((((timestamp / orbitPeriodSeconds) * 360 * 1.07) % 360) + 360) % 360 - 180;
  const lat = 51.6 * Math.sin(phase);
  return { lat, lon, timestamp };
}

async function getJson(url, options = {}) {
  const { timeoutMs = 6000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
    if (!response.ok) throw new Error(`Request failed with ${response.status}`);
    return response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchOpenNotify(path) {
  const target = `${OPEN_NOTIFY}${path}`;
  return getJson(`${CORS_PROXY}${encodeURIComponent(target)}`, { timeoutMs: 4500 });
}

export async function fetchIssPosition() {
  try {
    const data = await Promise.any([
      fetchOpenNotify("/iss-now.json"),
      getJson(ISS_FALLBACK, { timeoutMs: 3500 }).then((fallback) => ({
        iss_position: {
          latitude: fallback.latitude,
          longitude: fallback.longitude
        },
        timestamp: Math.floor(Date.now() / 1000)
      }))
    ]);
    return {
      lat: Number(data.iss_position.latitude),
      lon: Number(data.iss_position.longitude),
      timestamp: Number(data.timestamp)
    };
  } catch {
    return estimateIssPosition();
  }
}

export async function fetchAstronauts() {
  try {
    const data = await Promise.any([
      fetchOpenNotify("/astros.json"),
      getJson("https://corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json", {
        timeoutMs: 4500
      }).then((fallback) => ({
        number: fallback.number,
        people: (fallback.people || []).map((person) => ({
          name: person.name,
          craft: person.spacecraft || person.craft || person.position || "Space"
        }))
      }))
    ]);
    return {
      count: Number(data.number || data.people?.length || 0),
      people: (data.people || []).map((person) => ({
        name: person.name,
        craft: person.craft
      }))
    };
  } catch {
    return {
      count: 0,
      people: [],
      error: "People-in-space API is currently unreachable."
    };
  }
}

export async function reverseGeocode(lat, lon) {
  try {
    const data = await getJson(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=5`
    );
    return (
      data.address?.city ||
      data.address?.town ||
      data.address?.state ||
      data.address?.country ||
      data.name ||
      data.display_name ||
      fallbackPlaceName(lat, lon)
    );
  } catch {
    return fallbackPlaceName(lat, lon);
  }
}

function extractEventRegistryItems(data) {
  if (Array.isArray(data?.events?.results)) return data.events.results;
  if (Array.isArray(data?.breakingEvents?.results)) return data.breakingEvents.results;
  if (Array.isArray(data?.breakingEvents)) return data.breakingEvents;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data)) return data;
  return [];
}

function normalizeEventRegistryItem(item, category, index) {
  const article =
    item.article ||
    item.articles?.results?.[0] ||
    item.stories?.[0] ||
    item;
  const source =
    article.source?.title ||
    article.source?.uri ||
    item.source?.title ||
    item.source?.uri ||
    "Event Registry";

  return normalizeArticle(
    {
      id: item.uri || article.uri,
      title: item.title?.eng || item.title || article.title,
      source,
      author: article.authors?.[0]?.name || article.author,
      date: item.eventDate || item.date || article.dateTime || article.date || article.publishedAt,
      image: item.image || article.image,
      description: item.summary?.eng || item.summary || article.body || article.description,
      url: article.url || item.url || (item.uri ? `https://eventregistry.org/event/${item.uri}` : "#")
    },
    category,
    index
  );
}

async function fetchWithEventRegistry(category) {
  const key = import.meta.env.VITE_NEWS_API_KEY;
  if (!key) throw new Error("Missing VITE_NEWS_API_KEY");
  const url = new URL(EVENT_REGISTRY_BREAKING);
  url.searchParams.set("breakingEventsMinBreakingScore", "0.2");
  url.searchParams.set("apiKey", key);
  const data = await getJson(url.toString(), { timeoutMs: 8000 });
  const keywords = category === "Space" ? ["space", "nasa", "rocket", "satellite", "astronaut"] : ["technology", "tech", "ai", "software", "science"];
  const articles = extractEventRegistryItems(data)
    .map((item, index) => normalizeEventRegistryItem(item, category, index))
    .filter((article) => {
      const text = `${article.title} ${article.description}`.toLowerCase();
      return keywords.some((keyword) => text.includes(keyword));
    });
  return (articles.length ? articles : extractEventRegistryItems(data).map((item, index) => normalizeEventRegistryItem(item, category, index))).slice(0, 5);
}

async function fetchWithNewsApi(category) {
  const key = import.meta.env.VITE_NEWS_API_KEY;
  if (!key) throw new Error("Missing VITE_NEWS_API_KEY");
  const query = category === "Space" ? "space OR NASA OR satellite" : "technology OR science OR AI";
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", query);
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "5");
  url.searchParams.set("apiKey", key);
  const data = await getJson(url.toString());
  return (data.articles || []).map((article, index) => normalizeArticle(article, category, index));
}

async function fetchFallbackNews(category) {
  if (category === "Space") {
    const data = await getJson("https://api.spaceflightnewsapi.net/v4/articles/?limit=5");
    return (data.results || []).map((article, index) => normalizeArticle(article, category, index));
  }

  const data = await getJson("https://hn.algolia.com/api/v1/search_by_date?tags=story&query=technology&hitsPerPage=5");
  return (data.hits || []).map((article, index) =>
    normalizeArticle(
      {
        title: article.title || article.story_title,
        source: "Hacker News",
        author: article.author,
        date: article.created_at,
        description: article._highlightResult?.title?.value?.replace(/<[^>]+>/g, "") || "Technology story from Hacker News.",
        url: article.url || `https://news.ycombinator.com/item?id=${article.objectID}`,
        image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80"
      },
      category,
      index
    )
  );
}

export async function fetchNewsCategory(category) {
  try {
    return await fetchWithEventRegistry(category);
  } catch {
    try {
      return await fetchWithNewsApi(category);
    } catch {
      return fetchFallbackNews(category);
    }
  }
}

export async function askHuggingFace(messages, dashboardContext) {
  const token = import.meta.env.VITE_AI_TOKEN;
  if (!token) throw new Error("Missing VITE_AI_TOKEN");
  const latest = messages[messages.length - 1]?.content || "";
  const prompt = `<s>[INST] You are a dashboard assistant. Answer only from this JSON dashboard data. If the answer is not present, say you can only answer from dashboard data.
Dashboard data:
${JSON.stringify(dashboardContext, null, 2)}

Question: ${latest} [/INST]`;
  const response = await getJson(
    "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 220,
          temperature: 0.2,
          return_full_text: false
        }
      })
    }
  );
  return Array.isArray(response) ? response[0]?.generated_text?.trim() : response.generated_text?.trim();
}

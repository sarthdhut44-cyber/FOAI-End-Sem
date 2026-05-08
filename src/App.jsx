import { Moon, RefreshCcw, Sun, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAstronauts, fetchIssPosition, fetchNewsCategory, reverseGeocode } from "./api";
import Chatbot from "./components/Chatbot";
import { NewsDistributionChart, SpeedChart } from "./components/Charts";
import IssMap from "./components/IssMap";
import NewsPanel from "./components/NewsPanel";
import {
  ISS_CACHE_KEY,
  NEWS_CACHE_KEY,
  NEWS_CACHE_TTL,
  SPEED_CACHE_KEY,
  THEME_KEY,
  computeSpeedKmh,
  loadJson,
  saveJson
} from "./utils";

const NEWS_CATEGORIES = ["Space", "Technology"];

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "dark");
  const [issPath, setIssPath] = useState(() => loadJson(ISS_CACHE_KEY, []).slice(-15));
  const [speedHistory, setSpeedHistory] = useState(() => loadJson(SPEED_CACHE_KEY, []).slice(-30));
  const [speed, setSpeed] = useState(0);
  const [place, setPlace] = useState("Finding nearest place...");
  const [astronauts, setAstronauts] = useState({ count: 0, people: [] });
  const [issLoading, setIssLoading] = useState(true);
  const [issError, setIssError] = useState("");
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("date");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [toast, setToast] = useState("");

  const current = issPath[issPath.length - 1];
  const currentLat = current?.lat;
  const currentLon = current?.lon;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const notify = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  }, []);

  const refreshIss = useCallback(async (showToast) => {
    setIssLoading(true);
    setIssError("");
    try {
      const position = await fetchIssPosition();
      setIssPath((previousPath) => {
        const previous = previousPath[previousPath.length - 1];
        const hasNewPosition =
          !previous ||
          previous.timestamp !== position.timestamp ||
          previous.lat !== position.lat ||
          previous.lon !== position.lon;
        const calculatedSpeed =
          previous && hasNewPosition && previous.timestamp !== position.timestamp
            ? computeSpeedKmh(previous, position)
            : 27600;
        setSpeed(calculatedSpeed);
        setSpeedHistory((history) => {
          const next = [...history, { time: position.timestamp * 1000, speed: calculatedSpeed }].slice(-30);
          saveJson(SPEED_CACHE_KEY, next);
          return next;
        });
        if (!hasNewPosition) return previousPath;
        const nextPath = [...previousPath, position].slice(-15);
        saveJson(ISS_CACHE_KEY, nextPath);
        return nextPath;
      });
      if (showToast) notify("ISS position refreshed");
    } catch {
      setIssError("Could not fetch ISS location. Please retry.");
    } finally {
      setIssLoading(false);
    }
  }, [notify]);

  const refreshAstronauts = useCallback(async () => {
    const data = await fetchAstronauts();
    setAstronauts(data);
  }, []);

  const loadNews = useCallback(async (forceRefresh, categoryToRefresh = null) => {
    setNewsLoading(true);
    setNewsError("");
    try {
      const cached = loadJson(NEWS_CACHE_KEY, null);
      if (!forceRefresh && cached && Date.now() - cached.timestamp < NEWS_CACHE_TTL) {
        setNews(cached.articles);
        setNewsLoading(false);
        return;
      }
      const categoriesToFetch = categoryToRefresh ? [categoryToRefresh] : NEWS_CATEGORIES;
      const results = await Promise.all(categoriesToFetch.map((category) => fetchNewsCategory(category)));
      const fetchedArticles = results.flat();
      const articles = categoryToRefresh
        ? [...news.filter((article) => article.category !== categoryToRefresh), ...fetchedArticles].slice(0, 10)
        : fetchedArticles.slice(0, 10);
      setNews(articles);
      saveJson(NEWS_CACHE_KEY, { timestamp: Date.now(), articles });
      notify(categoryToRefresh ? `${categoryToRefresh} news refreshed` : "News refreshed");
    } catch {
      setNewsError("News could not be loaded. Check your API key or network connection.");
    } finally {
      setNewsLoading(false);
    }
  }, [news, notify]);

  useEffect(() => {
    refreshIss(true);
    const timer = window.setInterval(() => refreshIss(false), 15000);
    return () => window.clearInterval(timer);
  }, [refreshIss]);

  useEffect(() => {
    refreshAstronauts();
    loadNews(false);
  }, [loadNews, refreshAstronauts]);

  useEffect(() => {
    if (currentLat === undefined || currentLon === undefined) return;
    reverseGeocode(currentLat, currentLon).then(setPlace);
  }, [currentLat, currentLon]);

  const filteredNews = useMemo(() => {
    const term = search.toLowerCase();
    return news
      .filter((article) => selectedCategory === "All" || article.category === selectedCategory)
      .filter((article) => `${article.title} ${article.source} ${article.description}`.toLowerCase().includes(term))
      .sort((a, b) => {
        if (sort === "source") return a.source.localeCompare(b.source);
        return new Date(b.date) - new Date(a.date);
      });
  }, [news, search, selectedCategory, sort]);

  const distribution = useMemo(() => {
    return NEWS_CATEGORIES.reduce((acc, category) => {
      acc[category] = news.filter((article) => article.category === category).length;
      return acc;
    }, {});
  }, [news]);

  const chatContext = {
    iss: { current, speed, place, positionsTracked: issPath.length },
    astronauts,
    news: filteredNews.map(({ title, source, author, date, description, category }) => ({
      title,
      source,
      author,
      date,
      description,
      category
    }))
  };

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">FOAI End Semester Project</p>
          <h1>ISS Live Tracking, News and Dashboard AI</h1>
          <p>Real-time orbital telemetry, current space/technology headlines, interactive visuals, and a chatbot restricted to this dashboard's data.</p>
        </div>
        <button className="theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </header>

      <section className="grid overview">
        <div className="metric-card">
          <span>Latitude</span>
          <strong>{current ? current.lat.toFixed(4) : "--"}</strong>
        </div>
        <div className="metric-card">
          <span>Longitude</span>
          <strong>{current ? current.lon.toFixed(4) : "--"}</strong>
        </div>
        <div className="metric-card">
          <span>ISS Speed</span>
          <strong>{Math.round(speed).toLocaleString()} km/h</strong>
        </div>
        <div className="metric-card">
          <span>Positions Tracked</span>
          <strong>{issPath.length}</strong>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="panel map-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Live every 15 seconds</p>
              <h2>ISS Current Location</h2>
              <p>{place}</p>
            </div>
            <button className="icon-button text-button" onClick={() => refreshIss(true)} disabled={issLoading}>
              <RefreshCcw size={18} className={issLoading ? "spin" : ""} />
              Refresh
            </button>
          </div>
          {issError && (
            <div className="error-box">
              <span>{issError}</span>
              <button onClick={() => refreshIss(true)}>Retry</button>
            </div>
          )}
          <IssMap current={current} path={issPath} speed={speed} />
        </div>

        <div className="panel astronauts-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Open Notify</p>
              <h2>People in Space</h2>
            </div>
            <button className="icon-button" onClick={refreshAstronauts} aria-label="Refresh astronauts">
              <RefreshCcw size={18} />
            </button>
          </div>
          <div className="people-count">
            <Users size={30} />
            <strong>{astronauts.count}</strong>
            <span>people right now</span>
          </div>
          <div className="people-list">
            {astronauts.people.length ? (
              astronauts.people.map((person) => (
                <span key={`${person.name}-${person.craft}`}>
                  {person.name} <small>{person.craft}</small>
                </span>
              ))
            ) : (
              <p>{astronauts.error || "Names will appear here when available."}</p>
            )}
          </div>
        </div>
      </section>

      <section className="charts-grid">
        <SpeedChart history={speedHistory} />
        <NewsDistributionChart categories={distribution} selected={selectedCategory} onSelect={setSelectedCategory} />
      </section>

      <NewsPanel
        articles={filteredNews}
        categories={NEWS_CATEGORIES}
        selectedCategory={selectedCategory}
        search={search}
        sort={sort}
        loading={newsLoading}
        error={newsError}
        onSearch={setSearch}
        onSort={setSort}
        onRefresh={(category) => loadNews(true, category)}
        onCategory={setSelectedCategory}
      />

      <section className="panel answer-box">
        <h2>Assignment Answer</h2>
        <p>
          This application uses <strong>mistralai/Mistral-7B-Instruct-v0.2</strong> through Hugging Face because it is an instruction-tuned LLM that can follow strict context rules. The chatbot prompt supplies only the live ISS, astronaut, and news dashboard data, so it can answer project questions without relying on outside knowledge or guessing.
        </p>
      </section>

      {toast && <div className="toast">{toast}</div>}
      <Chatbot context={chatContext} />
    </main>
  );
}

import { Calendar, ExternalLink, RefreshCcw, Search } from "lucide-react";
import { formatDate } from "../utils";

export default function NewsPanel({
  articles,
  categories,
  selectedCategory,
  search,
  sort,
  loading,
  error,
  onSearch,
  onSort,
  onRefresh,
  onCategory
}) {
  return (
    <section className="panel news-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Latest Articles</p>
          <h2>News Dashboard</h2>
        </div>
        <div className="button-row">
          {categories.map((category) => (
            <button
              key={category}
              className={selectedCategory === category ? "chip active" : "chip"}
              onClick={() => onCategory(selectedCategory === category ? "All" : category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar">
        <label className="search-box">
          <Search size={18} />
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search articles" />
        </label>
        <select value={sort} onChange={(event) => onSort(event.target.value)} aria-label="Sort articles">
          <option value="date">Sort by date</option>
          <option value="source">Sort by source</option>
        </select>
        {categories.map((category) => (
          <button className="icon-button text-button" onClick={() => onRefresh(category)} key={`refresh-${category}`}>
            <RefreshCcw size={18} />
            {category}
          </button>
        ))}
        <button className="icon-button text-button" onClick={() => onRefresh()}>
          <RefreshCcw size={18} />
          Refresh all
        </button>
      </div>

      {error && (
        <div className="error-box">
          <span>{error}</span>
          <button onClick={() => onRefresh()}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="article-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="article-card skeleton" key={index} />
          ))}
        </div>
      ) : (
        <div className="article-grid">
          {articles.map((article) => (
            <article className="article-card" key={article.id}>
              <img src={article.image} alt="" loading="lazy" />
              <div className="article-body">
                <span className="category-pill">{article.category}</span>
                <h3>{article.title}</h3>
                <p>{article.description}</p>
                <div className="article-meta">
                  <span>{article.source}</span>
                  <span>{article.author}</span>
                </div>
                <div className="article-actions">
                  <span>
                    <Calendar size={15} />
                    {formatDate(article.date)}
                  </span>
                  <a href={article.url} target="_blank" rel="noreferrer">
                    Read More <ExternalLink size={15} />
                  </a>
                </div>
              </div>
            </article>
          ))}
          {!articles.length && <div className="empty-state">No articles match your filters.</div>}
        </div>
      )}
    </section>
  );
}

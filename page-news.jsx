/* ========== NEWS PAGE ========== */
const ARTICLES_RAW = [
  { id: 1, cat: "Producer", date: "22 Apr 2026", title: "Inside the Bidnija olive press, before first harvest", excerpt: "We spent a morning with Carmel and his team as they readied the cold-press for the season's first delivery of Bajda olives.", photo: "olive", read: 6, featured: true, published: true },
  { id: 2, cat: "Calendar", date: "18 Apr 2026", title: "Summer programme: 12 new sessions across Gozo", excerpt: "From cheesemaking in Xagħra to tuna sashimi in Marsalforn — here's what we're hosting between June and August.", photo: "harvest", read: 4, published: true },
  { id: 3, cat: "Recipe", date: "11 Apr 2026", title: "Ftira biż-żejt: a recipe handed down four generations", excerpt: "Maria Camilleri shares the bread her grandmother baked every Friday — three ingredients, one ancient oven.", photo: "bread", read: 5, published: true },
  { id: 4, cat: "Notice", date: "04 Apr 2026", title: "Mġarr session of 5 May moved to 12 May", excerpt: "Due to the Public Holiday programme, the Mġarr olive oil session has been rescheduled by a week.", photo: "honey", read: 2, published: true },
  { id: 5, cat: "Producer", date: "29 Mar 2026", title: "Why Maltese honey tastes of the wind", excerpt: "A short walk through the apiaries of Burmarrad with beekeeper Anna Bonnici.", photo: "honey", read: 4, published: true },
  { id: 6, cat: "Recipe", date: "21 Mar 2026", title: "Aljotta: the only fish soup you need", excerpt: "Garlic, tomato, marjoram, and whatever the morning's catch yields.", photo: "sea", read: 3, published: true },
  { id: 7, cat: "Producer", date: "14 Mar 2026", title: "The last cheesemaker of Ta' Sannat", excerpt: "Salvinu Mizzi has made ġbejniet by hand since 1971. We asked him why.", photo: "cheese", read: 7, published: true },
  { id: 8, cat: "Calendar", date: "07 Mar 2026", title: "Spring sessions are now open for booking", excerpt: "Reserve your spot for April and May — capacity is 24 per session.", photo: "harvest", read: 2, published: true },
  { id: 9, cat: "Notice", date: "28 Feb 2026", title: "Accessibility upgrades to all Gozo sessions", excerpt: "Step-free access and Maltese sign-language interpreters now available on request.", photo: "coast", read: 2, published: true },
  { id: 10, cat: "Recipe", date: "21 Feb 2026", title: "Capers, salt, and patience: kappar tal-Mellieħa", excerpt: "How a fortnight in brine turns spring buds into the islands' most distinctive seasoning.", photo: "harvest", read: 5, published: false },
];

const NewsPage = ({ lang }) => {
  const [activeCat, setActiveCat] = React.useState("All");
  const articles = ARTICLES_RAW.filter(a => a.published);
  const cats = ["All", ...Array.from(new Set(articles.map(a => a.cat)))];
  const filtered = activeCat === "All" ? articles : articles.filter(a => a.cat === activeCat);
  const featured = filtered.find(a => a.featured) || filtered[0];
  const rest = filtered.filter(a => a.id !== (featured && featured.id));

  const t = lang === "en" ? {
    eyebrow: "News & Updates",
    title: "Notes from the field.",
    sub: "Producer profiles, recipes, programme announcements, and seasonal notices — published as the harvest unfolds.",
    featured: "Featured",
    minRead: "min read",
    all: "All",
  } : {
    eyebrow: "Aħbarijiet",
    title: "Noti mill-għelieqi.",
    sub: "Profili tal-produtturi, riċetti, avviżi tal-programm — ippubblikati kif jiżvolġi l-istaġun.",
    featured: "Featured",
    minRead: "min qari",
    all: "Kollha",
  };

  return (
    <main>
      <section style={{ padding: "72px 32px 48px" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto" }}>
          <div className="mfe-eyebrow">{t.eyebrow}</div>
          <h1 className="mfe-h-display" style={{ marginTop: 22, maxWidth: 880 }}>{t.title}</h1>
          <p style={{ fontSize: 19, lineHeight: 1.55, color: "var(--mfe-ink-700)", marginTop: 24, maxWidth: 680 }}>{t.sub}</p>

          <div style={{ display: "flex", gap: 8, marginTop: 48, flexWrap: "wrap", paddingBottom: 8, borderBottom: "1px solid var(--mfe-cream-300)" }}>
            {cats.map(c => (
              <button
                key={c}
                onClick={() => setActiveCat(c)}
                style={{
                  padding: "10px 18px", borderRadius: 999, cursor: "pointer",
                  border: "1px solid",
                  borderColor: activeCat === c ? "var(--mfe-green-800)" : "var(--mfe-cream-300)",
                  background: activeCat === c ? "var(--mfe-green-800)" : "transparent",
                  color: activeCat === c ? "var(--mfe-cream-50)" : "var(--mfe-ink-700)",
                  fontFamily: "var(--mfe-sans)", fontSize: 13, fontWeight: 500,
                }}
              >
                {c === "All" ? t.all : c}
                <span style={{ marginLeft: 6, opacity: 0.6, fontFamily: "var(--mfe-mono)", fontSize: 11 }}>
                  {c === "All" ? articles.length : articles.filter(a => a.cat === c).length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Grid */}
      <section style={{ padding: "16px 32px 96px" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }} className="mfe-news-grid">
          {filtered.map(a => (
            <ArticleCard key={a.id} a={a} t={t} />
          ))}
        </div>
      </section>
    </main>
  );
};

const ArticleCard = ({ a, t }) => (
  <article style={{
    display: "flex", flexDirection: "column", gap: 16,
    cursor: "pointer", transition: "transform 0.2s ease",
  }}
    onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
    onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
  >
    <div className={`mfe-photo mfe-photo--${a.photo}`} style={{ aspectRatio: "4/3", borderRadius: "var(--mfe-r-lg)" }}>
      <span className="mfe-photo-label">{a.cat} · {a.date.split(" ")[1]}</span>
    </div>
    <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 4 }}>
      <span style={{
        fontFamily: "var(--mfe-mono)", fontSize: 10.5, letterSpacing: "0.14em",
        textTransform: "uppercase", color: "var(--mfe-terra-600)",
        padding: "4px 10px", borderRadius: 999,
        background: "rgba(217,119,87,0.1)",
      }}>{a.cat}</span>
      <span style={{ fontFamily: "var(--mfe-mono)", fontSize: 11, color: "var(--mfe-ink-500)", letterSpacing: "0.1em" }}>{a.date}</span>
      <span style={{ fontFamily: "var(--mfe-mono)", fontSize: 11, color: "var(--mfe-ink-500)", marginLeft: "auto" }}>{a.read} {t.minRead}</span>
    </div>
    <h3 style={{ fontFamily: "var(--mfe-serif)", fontWeight: 500, fontSize: 24, margin: 0, color: "var(--mfe-green-900)", lineHeight: 1.2 }}>{a.title}</h3>
    <p style={{ fontSize: 15, lineHeight: 1.55, color: "var(--mfe-ink-700)", margin: 0 }}>{a.excerpt}</p>
    <a href="#" style={{ marginTop: "auto", color: "var(--mfe-green-800)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
      Read article →
    </a>
  </article>
);

Object.assign(window, { NewsPage });

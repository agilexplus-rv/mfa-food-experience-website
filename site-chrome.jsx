/* Shared site chrome — sticky nav with EN/MT toggle, hamburger on mobile, footer */

const NAV_ITEMS = [
  { en: "Home", mt: "Hajja", page: "home" },
  { en: "About", mt: "Dwarna", page: "about" },
  { en: "News", mt: "Aħbarijiet", page: "news" },
  { en: "Booking", mt: "Ibbukkja", page: "booking" },
  { en: "Contact", mt: "Kuntatt", page: "contact" },
];

const SiteNav = ({ page, setPage, lang, setLang }) => {
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => { setMobileOpen(false); }, [page]);

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      background: scrolled ? "var(--mfe-cream-50)" : "var(--mfe-cream-50)",
      backdropFilter: "none",
      borderBottom: scrolled ? "1px solid var(--mfe-cream-200)" : "1px solid transparent",
      boxShadow: scrolled ? "0 4px 16px rgba(31,58,48,0.04)" : "none",
      transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    }}>
      <div style={{
        maxWidth: 1320, margin: "0 auto",
        padding: "16px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <button
          onClick={() => setPage("home")}
          style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
        >
          <BrandLockup tone="dark" compact />
        </button>

        {/* Desktop nav */}
        <nav className="mfe-desktop-nav" style={{ display: "flex", gap: 32, alignItems: "center" }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.page}
              onClick={() => setPage(item.page)}
              style={{
                background: "none", border: 0, padding: "6px 0", cursor: "pointer",
                fontFamily: "var(--mfe-sans)", fontSize: 14, fontWeight: 500,
                color: page === item.page ? "var(--mfe-terra-600)" : "var(--mfe-green-900)",
                position: "relative",
              }}
            >
              {lang === "en" ? item.en : item.mt}
              {page === item.page && (
                <span style={{
                  position: "absolute", left: 0, right: 0, bottom: -2, height: 2,
                  background: "var(--mfe-terra-500)", borderRadius: 1
                }} />
              )}
            </button>
          ))}
          <LangToggle lang={lang} setLang={setLang} />
          <button
            className="mfe-btn mfe-btn--terra"
            style={{ padding: "10px 18px", fontSize: 13 }}
            onClick={() => setPage("booking")}
          >
            {lang === "en" ? "Book a tasting" : "Ibbukkja"} →
          </button>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="mfe-mobile-hamburger"
          onClick={() => setMobileOpen(v => !v)}
          aria-label="Toggle menu"
          style={{
            display: "none", background: "none", border: 0, cursor: "pointer",
            padding: 8,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? (
              <><path d="M6 6 L18 18" /><path d="M18 6 L6 18" /></>
            ) : (
              <><path d="M3 6 H21" /><path d="M3 12 H21" /><path d="M3 18 H21" /></>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="mfe-mobile-drawer" style={{
          padding: "16px 32px 28px",
          borderTop: "1px solid var(--mfe-cream-200)",
          display: "none", flexDirection: "column", gap: 4,
          background: "var(--mfe-cream-50)",
        }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.page}
              onClick={() => setPage(item.page)}
              style={{
                background: "none", border: 0, padding: "14px 0", textAlign: "left", cursor: "pointer",
                fontFamily: "var(--mfe-serif)", fontSize: 22,
                color: page === item.page ? "var(--mfe-terra-600)" : "var(--mfe-green-900)",
                borderBottom: "1px solid var(--mfe-cream-200)",
              }}
            >
              {lang === "en" ? item.en : item.mt}
            </button>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
            <LangToggle lang={lang} setLang={setLang} />
            <button
              className="mfe-btn mfe-btn--terra"
              onClick={() => setPage("booking")}
            >
              {lang === "en" ? "Book a tasting" : "Ibbukkja"} →
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

const LangToggle = ({ lang, setLang }) => (
  <div style={{
    display: "inline-flex", alignItems: "center",
    border: "1px solid var(--mfe-cream-300)", borderRadius: 999,
    padding: 3, fontFamily: "var(--mfe-mono)", fontSize: 11, letterSpacing: "0.08em",
  }}>
    {["en", "mt"].map(l => (
      <button
        key={l}
        onClick={() => setLang(l)}
        style={{
          padding: "5px 12px", borderRadius: 999, border: 0, cursor: "pointer",
          background: lang === l ? "var(--mfe-green-800)" : "transparent",
          color: lang === l ? "var(--mfe-cream-50)" : "var(--mfe-ink-500)",
          textTransform: "uppercase", fontWeight: 600,
          fontFamily: "inherit",
        }}
      >{l}</button>
    ))}
  </div>
);

const SiteFooter = ({ lang, setPage }) => {
  const t = lang === "en" ? {
    tag: "A public initiative by the Malta Food Agency.",
    explore: "Explore",
    visit: "Visit",
    legal: "Legal",
    address: "Malta Food Agency · Pjazza San Kalċidonju, Floriana FRN 1230",
    follow: "Follow the harvest",
    privacy: "Privacy", terms: "Terms", accessibility: "Accessibility",
    rights: "© 2026 Malta Food Agency. All rights reserved.",
    newsletter: "Get the seasonal programme",
    sub: "Monthly notes from producers, recipes & upcoming sessions.",
    placeholder: "your@email.mt",
    join: "Join",
  } : {
    tag: "Inizjattiva pubblika mill-Aġenzija tal-Ikel ta' Malta.",
    explore: "Esplora",
    visit: "Żurna",
    legal: "Legali",
    address: "Aġenzija tal-Ikel · Pjazza San Kalċidonju, Floriana FRN 1230",
    follow: "Segwina",
    privacy: "Privatezza", terms: "Termini", accessibility: "Aċċessibbiltà",
    rights: "© 2026 Aġenzija tal-Ikel. Drittijiet riservati.",
    newsletter: "Programma tal-istaġun",
    sub: "Noti mill-produtturi, riċetti u sessjonijiet li ġejjin.",
    placeholder: "email@tieghek.mt",
    join: "Issieħeb",
  };

  return (
    <footer style={{
      background: "var(--mfe-green-900)", color: "var(--mfe-cream-100)",
      padding: "72px 32px 32px", marginTop: 0,
    }}>
      <div style={{ maxWidth: 1320, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1.6fr", gap: 48, alignItems: "start" }}
             className="mfe-footer-grid">
          <div>
            <BrandLockup tone="light" />
          </div>

          <FooterCol title={t.explore} links={[
            { label: lang === "en" ? "Home" : "Hajja", page: "home" },
            { label: lang === "en" ? "About" : "Dwarna", page: "about" },
            { label: lang === "en" ? "News & Updates" : "Aħbarijiet", page: "news" },
            { label: lang === "en" ? "Book a tasting" : "Ibbukkja", page: "booking" },
          ]} setPage={setPage} />

          <FooterCol title={t.visit} links={[
            { label: lang === "en" ? "Contact" : "Kuntatt", page: "contact" },
            { label: "Producers · 12", page: "about" },
            { label: lang === "en" ? "Programme calendar" : "Kalendarju", page: "booking" },
          ]} setPage={setPage} />

          <div>
            <FooterTitle>{t.newsletter}</FooterTitle>
            <p style={{ color: "rgba(250,246,238,0.7)", fontSize: 14, lineHeight: 1.55, marginBottom: 16 }}>
              {t.sub}
            </p>
            <form onSubmit={e => e.preventDefault()} style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
              <input
                type="email"
                placeholder={t.placeholder}
                style={{
                  flex: 1, background: "rgba(250,246,238,0.08)",
                  border: "1px solid rgba(250,246,238,0.2)",
                  borderRadius: 999, padding: "12px 18px", color: "var(--mfe-cream-50)",
                  fontFamily: "var(--mfe-sans)", fontSize: 14, outline: "none",
                }}
              />
              <button type="submit" className="mfe-btn mfe-btn--terra" style={{ padding: "12px 20px", fontSize: 13 }}>
                {t.join}
              </button>
            </form>
            <div style={{ marginTop: 24 }}>
              <FooterTitle small>{t.follow}</FooterTitle>
              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                {[
                  { name: "Instagram", path: "M7 2 H17 A5 5 0 0 1 22 7 V17 A5 5 0 0 1 17 22 H7 A5 5 0 0 1 2 17 V7 A5 5 0 0 1 7 2 Z M12 8 A4 4 0 1 1 12 16 A4 4 0 1 1 12 8 Z M17.5 5.5 L17.6 5.5", filled: false },
                  { name: "Facebook", path: "M14 8 V6.5 A1.5 1.5 0 0 1 15.5 5 H17 V2 H14.5 A4.5 4.5 0 0 0 10 6.5 V8 H7 V11 H10 V22 H14 V11 H17 L17.5 8 Z", filled: true },
                  { name: "YouTube", path: "M3 7 A2 2 0 0 1 5 5 H19 A2 2 0 0 1 21 7 V17 A2 2 0 0 1 19 19 H5 A2 2 0 0 1 3 17 Z M10 9 V15 L15 12 Z", filled: true },
                ].map(s => (
                  <a key={s.name} href="#" aria-label={s.name} style={{
                    width: 38, height: 38, borderRadius: 999,
                    border: "1px solid rgba(250,246,238,0.25)",
                    display: "grid", placeItems: "center",
                    color: "var(--mfe-cream-50)", textDecoration: "none",
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={s.filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
                      <path d={s.path} />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <hr style={{ border: 0, borderTop: "1px solid rgba(250,246,238,0.15)", margin: "56px 0 24px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, fontSize: 12, color: "rgba(250,246,238,0.55)", fontFamily: "var(--mfe-mono)", letterSpacing: "0.06em" }}>
          <span>{t.rights}</span>
          <span style={{ display: "flex", gap: 24 }}>
            <a href="#" style={{ color: "inherit", textDecoration: "none" }}>{t.privacy}</a>
            <a href="#" style={{ color: "inherit", textDecoration: "none" }}>{t.terms}</a>
            <a href="#" style={{ color: "inherit", textDecoration: "none" }}>{t.accessibility}</a>
          </span>
        </div>
      </div>
    </footer>
  );
};

const FooterTitle = ({ children, small }) => (
  <div style={{
    fontFamily: "var(--mfe-mono)", fontSize: small ? 10 : 11,
    letterSpacing: "0.16em", textTransform: "uppercase",
    color: "var(--mfe-gold-500)", marginBottom: 16,
  }}>{children}</div>
);

const FooterCol = ({ title, links, setPage }) => (
  <div>
    <FooterTitle>{title}</FooterTitle>
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      {links.map((l, i) => (
        <li key={i}>
          <button
            onClick={() => setPage(l.page)}
            style={{
              background: "none", border: 0, padding: 0, cursor: "pointer",
              color: "rgba(250,246,238,0.78)",
              fontFamily: "var(--mfe-sans)", fontSize: 14,
              textAlign: "left",
            }}
          >{l.label}</button>
        </li>
      ))}
    </ul>
  </div>
);

Object.assign(window, { SiteNav, SiteFooter, LangToggle });

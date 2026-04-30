/* ========== HOME PAGE ========== */

/* Hero with parallax photo + golden particle drift */
const HeroSection = ({ t, setPage }) => {
  const imgRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const sectionRef = React.useRef(null);

  // Parallax — subtle drift on cursor inside hero
  React.useEffect(() => {
    const img = imgRef.current;
    const section = sectionRef.current;
    if (!img || !section) return;

    let targetX = 0, targetY = 0, curX = 0, curY = 0;
    let raf = 0;
    const onMove = (e) => {
      const r = section.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      targetX = (x - 0.5) * 14;
      targetY = (y - 0.5) * 10;
    };
    const loop = () => {
      curX += (targetX - curX) * 0.045;
      curY += (targetY - curY) * 0.045;
      img.style.transform = `scale(1.06) translate(${-curX}px, ${-curY}px)`;
      raf = requestAnimationFrame(loop);
    };
    section.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(loop);
    return () => {
      section.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Golden particle drift
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const r = section.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      canvas.style.width = r.width + "px";
      canvas.style.height = r.height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const COUNT = 55;
    const w = () => canvas.width / dpr;
    const h = () => canvas.height / dpr;
    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * w(),
      y: Math.random() * h(),
      vx: (Math.random() - 0.5) * 0.25,
      vy: -0.1 - Math.random() * 0.28,
      size: Math.random() * 2.4 + 0.6,
      alpha: Math.random() * 0.32 + 0.08,
      phase: Math.random() * Math.PI * 2,
    }));

    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const W = w(), H = h();
      ctx.clearRect(0, 0, W, H);
      const t = Date.now() * 0.001;
      for (const p of particles) {
        p.x += p.vx + Math.sin(t * 0.5 + p.phase) * 0.18;
        p.y += p.vy + Math.cos(t * 0.3 + p.phase) * 0.12;
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10;
        if (p.y > H + 10) p.y = -10;
        const a = p.alpha * (0.5 + 0.5 * Math.sin(t * 1.5 + p.phase));
        const r = p.size * 4;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        grad.addColorStop(0, `rgba(255, 230, 160, ${a})`);
        grad.addColorStop(0.5, `rgba(255, 215, 120, ${a * 0.3})`);
        grad.addColorStop(1, "rgba(255, 200, 100, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    draw();
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section ref={sectionRef} style={{
      position: "relative",
      minHeight: "min(720px, 92vh)",
      display: "flex", alignItems: "flex-end",
      overflow: "hidden",
      background: "var(--mfe-green-900)",
      marginTop: -1,
    }}>
      {/* Photo with parallax */}
      <img
        ref={imgRef}
        src="assets/hero-tasting-table.png"
        alt="Tasting table at golden hour — artisans, ġbejna, olives and bread by the Mediterranean coast"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "center 45%",
          display: "block",
          transform: "scale(1.06)",
          willChange: "transform",
        }}
      />
      {/* Layered overlays for legibility + warmth */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(180deg, rgba(31,58,48,0.42) 0%, rgba(31,58,48,0.05) 30%, rgba(31,58,48,0.15) 55%, rgba(31,58,48,0.85) 100%)",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at 80% 20%, rgba(216,182,101,0.18), transparent 55%)",
        pointerEvents: "none",
      }} />
      {/* Golden particle canvas */}
      <canvas ref={canvasRef} aria-hidden="true" style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1,
      }} />

      {/* Bottom-anchored content */}
      <div style={{
        position: "relative", zIndex: 2,
        maxWidth: 1320, margin: "0 auto", width: "100%",
        padding: "120px 32px 56px",
      }}>
        <h1 style={{
          fontFamily: "var(--mfe-serif)", fontWeight: 500,
          fontSize: "clamp(48px, 7.6vw, 116px)", lineHeight: 0.98,
          letterSpacing: "-0.025em",
          color: "var(--mfe-cream-50)",
          margin: 0,
          textShadow: "0 2px 24px rgba(0,0,0,0.35)",
          maxWidth: 1100,
        }} className="mfe-hero-display">
          {t.h1a.replace(/,$/, "")}{" "}
          <span className="mfe-italic" style={{ color: "var(--mfe-gold-500)", fontWeight: 400 }}>of Malta,</span>
          <br />
          from <span style={{ color: "var(--mfe-terra-400)" }}>the soil up.</span>
        </h1>

        <div style={{ marginTop: 36, maxWidth: 640 }}>
          <p style={{
            fontSize: 18, lineHeight: 1.6,
            color: "rgba(250,246,238,0.88)",
            margin: 0,
            textShadow: "0 1px 8px rgba(0,0,0,0.25)",
          }}>
            {t.sub}
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
            <button className="mfe-btn mfe-btn--terra" onClick={() => setPage("booking")}>{t.book} →</button>
            <button className="mfe-btn mfe-btn--ghost-cream" onClick={() => setPage("about")}>{t.learn}</button>
          </div>
        </div>

        <div style={{
          marginTop: 56, paddingTop: 24,
          borderTop: "1px solid rgba(250,246,238,0.22)",
          display: "grid", gridTemplateColumns: "repeat(4, auto)",
          gap: 56, justifyContent: "start",
        }} className="mfe-hero-strip">
          {t.stats.map(([n, l]) => (
            <div key={l}>
              <div style={{ fontFamily: "var(--mfe-serif)", fontSize: 32, color: "var(--mfe-cream-50)", lineHeight: 1 }}>{n}</div>
              <div style={{ fontFamily: "var(--mfe-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 8, color: "rgba(250,246,238,0.7)" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const HomePage = ({ setPage, lang }) => {
  const t = lang === "en" ? {
    eyebrow: "A Public Initiative · 2026 Programme",
    h1a: "Taste the islands,",
    h1b: "slowly.",
    sub: "Six weeks of free public tastings hosted by the Malta Food Agency — meet the producers behind ġbejna tan-nagħaġ, cold-pressed olive oil, sourdough ħobż, and the harvest that defines our table.",
    book: "Reserve your spot",
    learn: "About the initiative",
    stats: [["12", "Producers"], ["48", "Tasting sessions"], ["6", "Maltese regions"], ["Free", "All sessions"]],
    sectionEyebrow: "What you'll taste",
    sectionTitle: "A season at the table.",
    sectionLead: "Each session pairs one or two producers with a guided tasting — bring your appetite, your questions, and your kids.",
    foods: [
      { tag: "01", name: "Ġbejna tan-Nagħaġ", note: "Sheep's-milk cheeselets from Gozo, served fresh, peppered, or dried.", photo: "cheese", label: "Ta' Sannat dairy" },
      { tag: "02", name: "Żejt taż-Żebbuġa", note: "First-press Maltese olive oil — a single-island blend of Bidnija and Bajda varieties.", photo: "olive", label: "Bidnija press" },
      { tag: "03", name: "Ħobż tal-Malti", note: "Slow-fermented sourdough loaves, taken straight from the wood-fired oven.", photo: "bread", label: "Qormi bakery" },
      { tag: "04", name: "Għasel tal-Bajtra", note: "Wildflower and prickly-pear honey from beekeepers across Mġarr and Siġġiewi.", photo: "honey", label: "Mġarr apiary" },
      { tag: "05", name: "Inbid Malti", note: "Indigenous Ġellewża and Girgentina wines — small-batch, family-run.", photo: "wine", label: "Marsovin estate" },
      { tag: "06", name: "Frott u Ħaxix", note: "Tomatoes, capers, and brassicas from the agricultural heart of the island.", photo: "harvest", label: "Mġarr fields" },
    ],
    nextEyebrow: "Next sessions",
    nextTitle: "Reserve your seat.",
    nextSub: "Sessions are free but capacity is limited to 24 guests.",
    seeAll: "See full calendar →",
    sessions: [
      { date: "Sat 09 May", region: "Mġarr", topic: "Olive Oil + Bread", time: "10:00 — 12:00", spots: 6 },
      { date: "Sun 17 May", region: "Gozo · Xagħra", topic: "Ġbejniet Workshop", time: "11:00 — 13:30", spots: 3 },
      { date: "Sat 23 May", region: "Burmarrad", topic: "Honey + Citrus", time: "16:00 — 18:00", spots: 12 },
      { date: "Sun 31 May", region: "Marsaxlokk", topic: "Sea to Table", time: "09:30 — 12:30", spots: 8 },
    ],
    quoteEyebrow: "Voices",
    quote: "\u201CWhen you taste an oil pressed thirty kilometres away, you start tasting the place — the dust, the wind, the patience of the trees.\u201D",
    quoteAttr: "— Carmel Borg, Bidnija olive grower",
    ctaTitle: "Come hungry. Leave knowing.",
    ctaSub: "Sessions run April through September across Malta and Gozo.",
    ctaBook: "Book a tasting",
    ctaContact: "Get in touch",
    spots: "spots left",
  } : {
    eyebrow: "Inizjattiva Pubblika · Programma 2026",
    h1a: "Duq il-gżejjer,",
    h1b: "bil-mod.",
    sub: "Sitt ġimgħat ta' degustazzjonijiet pubbliċi b'xejn organizzati mill-Aġenzija tal-Ikel ta' Malta — iltaqa' mal-produtturi tal-ġbejna tan-nagħaġ, żejt taż-żebbuġa, ħobż tal-Malti u l-frott tal-art.",
    book: "Ibbukkja postok",
    learn: "Dwar l-inizjattiva",
    stats: [["12", "Produtturi"], ["48", "Sessjonijiet"], ["6", "Reġjuni"], ["Free", "Kollox b'xejn"]],
    sectionEyebrow: "X'tassaġġa",
    sectionTitle: "Staġun fuq il-mejda.",
    sectionLead: "Kull sessjoni tagħqad produttur jew tnejn ma' degustazzjoni gwidata.",
    foods: [
      { tag: "01", name: "Ġbejna tan-Nagħaġ", note: "Ġbejniet tal-ħalib tan-nagħaġ minn Għawdex.", photo: "cheese", label: "Ta' Sannat" },
      { tag: "02", name: "Żejt taż-Żebbuġa", note: "Żejt Malti l-ewwel pressa, mill-Bidnija.", photo: "olive", label: "Bidnija" },
      { tag: "03", name: "Ħobż tal-Malti", note: "Ħobż bl-għaġina mqabbża, mill-forn tal-injam.", photo: "bread", label: "Ħal Qormi" },
      { tag: "04", name: "Għasel tal-Bajtra", note: "Għasel mill-bdiewa tal-Mġarr u Siġġiewi.", photo: "honey", label: "Mġarr" },
      { tag: "05", name: "Inbid Malti", note: "Inbejjed Ġellewża u Girgentina, batch żgħir.", photo: "wine", label: "Marsovin" },
      { tag: "06", name: "Frott u Ħaxix", note: "Tadam, kappar u ħxejjex mill-Mġarr.", photo: "harvest", label: "Mġarr" },
    ],
    nextEyebrow: "Sessjonijiet li ġejjin",
    nextTitle: "Ibbukkja postok.",
    nextSub: "B'xejn iżda l-postijiet huma limitati għal 24.",
    seeAll: "Ara l-kalendarju →",
    sessions: [
      { date: "Sib 09 Mej", region: "Mġarr", topic: "Żejt + Ħobż", time: "10:00 — 12:00", spots: 6 },
      { date: "Ħad 17 Mej", region: "Għawdex · Xagħra", topic: "Ġbejniet", time: "11:00 — 13:30", spots: 3 },
      { date: "Sib 23 Mej", region: "Burmarrad", topic: "Għasel + Larinġ", time: "16:00 — 18:00", spots: 12 },
      { date: "Ħad 31 Mej", region: "Marsaxlokk", topic: "Mill-Baħar", time: "09:30 — 12:30", spots: 8 },
    ],
    quoteEyebrow: "Vuċijiet",
    quote: "\u201CMeta tassaġġa żejt magħsur tletin kilometru bogħod, tibda tassaġġa l-post.\u201D",
    quoteAttr: "— Carmel Borg, Bidnija",
    ctaTitle: "Ejja bil-ġuħ. Itlaq taf.",
    ctaSub: "April sa Settembru, f'Malta u Għawdex.",
    ctaBook: "Ibbukkja",
    ctaContact: "Ikkuntattjana",
    spots: "postijiet",
  };

  return (
    <main>
      {/* HERO — Full-bleed photographic, badge + bottom-anchored content */}
      <HeroSection t={t} setPage={setPage} />

      {/* WHAT YOU'LL TASTE */}
      <section style={{ background: "var(--mfe-cream-50)", padding: "112px 32px", borderTop: "1px solid var(--mfe-cream-300)" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 48, alignItems: "end", marginBottom: 56 }} className="mfe-hero-grid">
            <div>
              <div className="mfe-eyebrow">{t.sectionEyebrow}</div>
              <h2 className="mfe-h-section" style={{ marginTop: 18 }}>{t.sectionTitle}</h2>
            </div>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: "var(--mfe-ink-700)" }}>{t.sectionLead}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }} className="mfe-cards-grid">
            {t.foods.map(f => (
              <article key={f.tag} style={{
                background: "var(--mfe-cream-50)", borderRadius: "var(--mfe-r-lg)",
                padding: 24, display: "flex", flexDirection: "column", gap: 18,
                border: "1px solid var(--mfe-cream-200)",
              }}>
                <div className={`mfe-photo mfe-photo--${f.photo}`} style={{ aspectRatio: "4/3", borderRadius: "var(--mfe-r-md)" }}>
                  <span className="mfe-photo-label">{f.label}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontFamily: "var(--mfe-mono)", fontSize: 11, color: "var(--mfe-terra-600)", letterSpacing: "0.14em" }}>{f.tag}</span>
                  <span style={{ fontFamily: "var(--mfe-mono)", fontSize: 10, color: "var(--mfe-ink-500)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Featured</span>
                </div>
                <h3 style={{ fontFamily: "var(--mfe-serif)", fontWeight: 500, fontSize: 26, margin: 0, color: "var(--mfe-green-900)" }}>{f.name}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--mfe-ink-700)", margin: 0 }}>{f.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* NEXT SESSIONS */}
      <section style={{ padding: "96px 32px" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 40, flexWrap: "wrap", gap: 24 }}>
            <div>
              <div className="mfe-eyebrow">{t.nextEyebrow}</div>
              <h2 className="mfe-h-section" style={{ marginTop: 18 }}>{t.nextTitle}</h2>
              <p style={{ fontSize: 16, color: "var(--mfe-ink-500)", marginTop: 12 }}>{t.nextSub}</p>
            </div>
            <button className="mfe-btn mfe-btn--ghost" onClick={() => setPage("booking")}>{t.seeAll}</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {t.sessions.map((s, i) => (
              <button
                key={i}
                onClick={() => setPage("booking")}
                style={{
                  display: "grid", gridTemplateColumns: "120px 1fr 1.4fr 130px 130px auto",
                  gap: 24, alignItems: "center", padding: "24px 8px",
                  borderTop: i === 0 ? "1px solid var(--mfe-cream-300)" : "none",
                  borderBottom: "1px solid var(--mfe-cream-300)",
                  background: "none", border: 0,
                  borderTopWidth: i === 0 ? 1 : 0, borderTopStyle: "solid", borderTopColor: "var(--mfe-cream-300)",
                  borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "var(--mfe-cream-300)",
                  cursor: "pointer", textAlign: "left", color: "inherit",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--mfe-cream-100)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                className="mfe-session-row"
              >
                <span style={{ fontFamily: "var(--mfe-mono)", fontSize: 12, color: "var(--mfe-terra-600)", letterSpacing: "0.1em" }}>{s.date}</span>
                <span style={{ fontFamily: "var(--mfe-sans)", fontWeight: 600, fontSize: 16, color: "var(--mfe-green-900)" }}>{s.region}</span>
                <span style={{ fontFamily: "var(--mfe-serif)", fontStyle: "italic", fontSize: 22, color: "var(--mfe-green-800)" }}>{s.topic}</span>
                <span style={{ fontFamily: "var(--mfe-mono)", fontSize: 12, color: "var(--mfe-ink-500)" }}>{s.time}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: s.spots <= 4 ? "var(--mfe-terra-600)" : "var(--mfe-ink-500)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: s.spots <= 4 ? "var(--mfe-terra-500)" : "var(--mfe-green-600)" }} />
                  {s.spots} {t.spots}
                </span>
                <span style={{ color: "var(--mfe-green-800)", fontSize: 18 }}>→</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* QUOTE */}
      <section style={{ background: "var(--mfe-green-900)", color: "var(--mfe-cream-50)", padding: "120px 32px", position: "relative", overflow: "hidden" }}>
        <svg width="100%" height="100%" viewBox="0 0 1200 600" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, opacity: 0.3, pointerEvents: "none" }}>
          <path d="M 1100 -50 Q 950 250 1180 500" stroke="var(--mfe-terra-400)" strokeWidth="1" fill="none" />
          <path d="M 1180 -20 Q 1000 280 1240 520" stroke="var(--mfe-gold-500)" strokeWidth="1" fill="none" />
          <path d="M 1050 -50 Q 880 220 1140 480" stroke="var(--mfe-green-600)" strokeWidth="1.5" fill="none" />
        </svg>
        <div style={{ maxWidth: 980, margin: "0 auto", textAlign: "center", position: "relative" }}>
          <div className="mfe-eyebrow" style={{ color: "var(--mfe-gold-500)", justifyContent: "center" }}>{t.quoteEyebrow}</div>
          <p style={{
            fontFamily: "var(--mfe-serif)", fontWeight: 400, fontStyle: "italic",
            fontSize: "clamp(28px, 3.6vw, 48px)", lineHeight: 1.25, letterSpacing: "-0.01em",
            margin: "28px 0 32px",
          }}>{t.quote}</p>
          <div style={{ fontFamily: "var(--mfe-mono)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mfe-gold-500)" }}>
            {t.quoteAttr}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "96px 32px", background: "var(--mfe-cream-100)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", textAlign: "center" }}>
          <h2 className="mfe-h-section">{t.ctaTitle}</h2>
          <p style={{ fontSize: 18, color: "var(--mfe-ink-700)", marginTop: 16 }}>{t.ctaSub}</p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 36, flexWrap: "wrap" }}>
            <button className="mfe-btn mfe-btn--terra" onClick={() => setPage("booking")}>{t.ctaBook}</button>
            <button className="mfe-btn mfe-btn--ghost" onClick={() => setPage("contact")}>{t.ctaContact}</button>
          </div>
        </div>
      </section>
    </main>
  );
};

Object.assign(window, { HomePage });

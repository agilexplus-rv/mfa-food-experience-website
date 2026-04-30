/* ========== ABOUT PAGE ========== */
const AboutPage = ({ setPage, lang }) => {
  const t = lang === "en" ? {
    eyebrow: "About the Initiative",
    title: "A table set for the public.",
    intro: "Malta Food Experience is a free, year-long programme by the Malta Food Agency that opens the doors of small producers, family farms, and traditional artisans to the public. It is part outreach, part celebration, part quiet act of preservation.",
    sections: [
      { h: "Why now", body: "Maltese food culture is changing fast. Imports are abundant, traditional skills are concentrated in fewer hands each year, and the link between what's on the plate and what grows in the soil is thinning. This initiative is a structured way to reverse that — by inviting people to meet the producers who keep these traditions alive, taste their work, and take a piece of it home." },
      { h: "Who it's for", body: "Everyone living on or visiting the Maltese islands. Sessions are designed to be intergenerational — bring your kids, your grandparents, your visiting cousins from abroad. We translate everything into English and Maltese, and accommodate dietary requirements." },
      { h: "How sessions work", body: "Each session lasts two to three hours. A producer hosts you on their farm, in their bakery, at their press. They walk you through the process — the seasonal rhythm, the constraints, the joy. You taste, you ask questions, you leave with a small gift to take home." },
    ],
    pillarsEyebrow: "Our principles",
    pillarsTitle: "Three things we won't compromise on.",
    pillars: [
      { tag: "01", h: "Free, always", body: "Public money funds public access. Every session — across all six regions and the full season — is free to attend. We never charge admission." },
      { tag: "02", h: "Producer-first", body: "Producers are paid for their time and their product. We work around their season, not the other way around. They lead the session; we just open the door." },
      { tag: "03", h: "Small groups", body: "A maximum of 24 guests per session. Small enough to ask real questions, taste at your own pace, and leave knowing the people who fed you." },
    ],
    teamEyebrow: "Behind the programme",
    teamTitle: "A small team. A long table.",
    team: [
      { name: "Marija Cassar", role: "Programme Director", note: "Former chef, lifelong cheesemonger." },
      { name: "Joseph Vella", role: "Producer Liaison", note: "Speaks fluent farmer." },
      { name: "Anna Mizzi", role: "Public Programmes", note: "Designs the seasonal calendar." },
      { name: "Luca Borg", role: "Communications", body: "", note: "Writes everything you read here." },
    ],
    ctaTitle: "Want to take part?",
    ctaSub: "Browse the calendar and reserve a seat — sessions run April through September.",
    ctaBook: "Book a tasting",
  } : {
    eyebrow: "Dwar l-Inizjattiva",
    title: "Mejda għall-pubbliku.",
    intro: "Il-Malta Food Experience hija programm pubbliku b'xejn mill-Aġenzija tal-Ikel ta' Malta li jiftaħ il-bibien tal-produtturi żgħar, l-irziezet tal-familja, u s-snajja' tradizzjonali.",
    sections: [
      { h: "Għaliex issa", body: "Il-kultura tal-ikel Malti qed tinbidel malajr. L-inizjattiva hija mod strutturat biex il-pubbliku jiltaqa' mal-produtturi li jżommu dawn it-tradizzjonijiet ħajjin." },
      { h: "Għal min hi", body: "Għal kulħadd li jgħix jew jżur Malta u Għawdex. Is-sessjonijiet huma għall-familja kollha, b'tradizzjoni bil-Malti u bl-Ingliż." },
      { h: "Kif jaħdmu", body: "Kull sessjoni ddum sagħtejn jew tlieta. Produttur jilqgħek fir-razzett, fil-furnara, fil-pressa. Tassaġġa, tistaqsi, u titlaq b'rigal żgħir." },
    ],
    pillarsEyebrow: "Il-Prinċipji tagħna",
    pillarsTitle: "Tliet affarijiet li ma niċċedu fihom.",
    pillars: [
      { tag: "01", h: "B'xejn, dejjem", body: "Il-flus pubbliċi jħallsu għal aċċess pubbliku. Qatt ma nitolbu ħlas." },
      { tag: "02", h: "Il-produttur l-ewwel", body: "Il-produtturi jitħallsu għal ħinhom u prodott. Aħna sempliċement niftħu l-bieb." },
      { tag: "03", h: "Gruppi żgħar", body: "Massimu ta' 24 mistieden kull sessjoni. Biżżejjed żgħar biex titgħallem." },
    ],
    teamEyebrow: "Wara l-programm",
    teamTitle: "Tim żgħir. Mejda twila.",
    team: [
      { name: "Marija Cassar", role: "Direttur tal-Programm", note: "Chef u espert fil-ġobon." },
      { name: "Joseph Vella", role: "Liaison Produtturi", note: "Jitkellem mal-bdiewa." },
      { name: "Anna Mizzi", role: "Programmi Pubbliċi", note: "Tfassal il-kalendarju." },
      { name: "Luca Borg", role: "Komunikazzjoni", note: "Jikteb dak li taqra hawn." },
    ],
    ctaTitle: "Trid tipparteċipa?",
    ctaSub: "Ara l-kalendarju u ibbukkja postok.",
    ctaBook: "Ibbukkja",
  };

  return (
    <main>
      <section style={{ padding: "72px 32px 96px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="mfe-eyebrow">{t.eyebrow}</div>
          <h1 className="mfe-h-display" style={{ marginTop: 22, maxWidth: 880 }}>{t.title}</h1>
          <p style={{ fontSize: 22, lineHeight: 1.5, color: "var(--mfe-ink-700)", marginTop: 36, maxWidth: 780 }}>
            {t.intro}
          </p>
        </div>
      </section>

      <section style={{ padding: "0 32px 96px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 56 }} className="mfe-hero-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            {t.sections.map((s, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 16, paddingTop: 28, borderTop: "1px solid var(--mfe-cream-300)" }}>
                <div style={{ fontFamily: "var(--mfe-mono)", fontSize: 11, color: "var(--mfe-terra-600)", letterSpacing: "0.14em" }}>0{i + 1}</div>
                <div>
                  <h3 style={{ fontFamily: "var(--mfe-serif)", fontWeight: 500, fontSize: 28, margin: 0, color: "var(--mfe-green-900)" }}>{s.h}</h3>
                  <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--mfe-ink-700)", marginTop: 12 }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 100, alignSelf: "start" }}>
            <div className="mfe-photo mfe-photo--harvest" style={{ borderRadius: "var(--mfe-r-lg)", aspectRatio: "4/5" }}>
              <span className="mfe-photo-label">Producer at work · Mġarr</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="mfe-photo mfe-photo--coast" style={{ borderRadius: "var(--mfe-r-md)", aspectRatio: "1/1" }}>
                <span className="mfe-photo-label">Gozo coast</span>
              </div>
              <div className="mfe-photo mfe-photo--cheese" style={{ borderRadius: "var(--mfe-r-md)", aspectRatio: "1/1" }}>
                <span className="mfe-photo-label">Curing room</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PILLARS */}
      <section style={{ background: "var(--mfe-green-900)", color: "var(--mfe-cream-50)", padding: "96px 32px" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto" }}>
          <div className="mfe-eyebrow" style={{ color: "var(--mfe-gold-500)" }}>{t.pillarsEyebrow}</div>
          <h2 className="mfe-h-section" style={{ color: "var(--mfe-cream-50)", marginTop: 18, maxWidth: 720 }}>{t.pillarsTitle}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginTop: 56 }} className="mfe-cards-grid">
            {t.pillars.map(p => (
              <div key={p.tag} style={{
                padding: "32px 28px", borderRadius: "var(--mfe-r-lg)",
                background: "rgba(250,246,238,0.05)",
                border: "1px solid rgba(250,246,238,0.12)",
              }}>
                <div style={{ fontFamily: "var(--mfe-mono)", fontSize: 11, color: "var(--mfe-gold-500)", letterSpacing: "0.14em" }}>{p.tag}</div>
                <h3 style={{ fontFamily: "var(--mfe-serif)", fontWeight: 500, fontSize: 28, margin: "16px 0 12px" }}>{p.h}</h3>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(250,246,238,0.78)", margin: 0 }}>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TEAM */}
      <section style={{ padding: "96px 32px" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto" }}>
          <div className="mfe-eyebrow">{t.teamEyebrow}</div>
          <h2 className="mfe-h-section" style={{ marginTop: 18 }}>{t.teamTitle}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24, marginTop: 48 }} className="mfe-cards-grid">
            {t.team.map(m => (
              <div key={m.name}>
                <div className="mfe-photo mfe-photo--olive" style={{ aspectRatio: "1/1", borderRadius: "var(--mfe-r-lg)" }}>
                  <span className="mfe-photo-label">{m.name.split(" ")[0]}</span>
                </div>
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontFamily: "var(--mfe-serif)", fontSize: 22, color: "var(--mfe-green-900)" }}>{m.name}</div>
                  <div style={{ fontFamily: "var(--mfe-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mfe-terra-600)", marginTop: 4 }}>{m.role}</div>
                  <div style={{ fontSize: 13.5, color: "var(--mfe-ink-500)", marginTop: 8 }}>{m.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "96px 32px", background: "var(--mfe-cream-100)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", textAlign: "center" }}>
          <h2 className="mfe-h-section">{t.ctaTitle}</h2>
          <p style={{ fontSize: 18, color: "var(--mfe-ink-700)", marginTop: 16 }}>{t.ctaSub}</p>
          <button className="mfe-btn mfe-btn--terra" style={{ marginTop: 32 }} onClick={() => setPage("booking")}>{t.ctaBook}</button>
        </div>
      </section>
    </main>
  );
};

Object.assign(window, { AboutPage });

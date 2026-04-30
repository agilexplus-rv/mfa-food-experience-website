/* ========== CONTACT PAGE — form + OpenStreetMap ========== */

const ContactPage = ({ lang }) => {
  const [form, setForm] = React.useState({ name: "", email: "", subject: "general", message: "" });
  const [sent, setSent] = React.useState(false);

  const t = lang === "en" ? {
    eyebrow: "Get in touch",
    title: "We'd love to hear from you.",
    sub: "Questions about a session, accessibility needs, group enquiries, press requests — drop us a note and we'll come back within two working days.",
    fields: { name: "Your name", email: "Email", subject: "What's this about?", message: "Message" },
    subjects: [
      { v: "general", l: "General enquiry" },
      { v: "booking", l: "Booking question" },
      { v: "access", l: "Accessibility request" },
      { v: "press", l: "Press / media" },
      { v: "producer", l: "I'm a producer" },
    ],
    send: "Send message",
    sentTitle: "Thank you.",
    sentSub: "Your message is on its way to our team. We'll reply within two working days.",
    sentAgain: "Send another",
    addressTitle: "Visit us",
    address: ["Malta Food Agency", "Pjazza San Kalċidonju", "Floriana FRN 1230", "Malta"],
    hoursTitle: "Office hours",
    hours: ["Mon — Fri · 09:00 — 17:00", "Sat · 09:00 — 12:00", "Sun · closed"],
    phoneTitle: "By phone",
    phone: "+356 2292 5000",
    emailTitle: "By email",
    email: "hello@maltafood.experience",
    mapEyebrow: "Find us",
    mapTitle: "Floriana, just outside Valletta.",
  } : {
    eyebrow: "Ikkuntattjana",
    title: "Nixtiequ nisimgħu mingħandek.",
    sub: "Mistoqsijiet, talbiet ta' aċċessibbiltà, jew ikkuntatja l-istampa — niktbulek f'jumejn xogħol.",
    fields: { name: "Ismek", email: "Email", subject: "X'inhi t-talba?", message: "Messaġġ" },
    subjects: [
      { v: "general", l: "Mistoqsija ġenerali" },
      { v: "booking", l: "Booking" },
      { v: "access", l: "Aċċessibbiltà" },
      { v: "press", l: "Stampa / Midja" },
      { v: "producer", l: "Jien produttur" },
    ],
    send: "Ibgħat",
    sentTitle: "Grazzi.",
    sentSub: "Il-messaġġ wasal. Inwieġbu f'jumejn xogħol.",
    sentAgain: "Ibgħat ieħor",
    addressTitle: "Żurna",
    address: ["Aġenzija tal-Ikel", "Pjazza San Kalċidonju", "Floriana FRN 1230", "Malta"],
    hoursTitle: "Ħinijiet tal-uffiċċju",
    hours: ["Tne — Ġim · 09:00 — 17:00", "Sib · 09:00 — 12:00", "Ħad · magħluq"],
    phoneTitle: "Bit-telefon",
    phone: "+356 2292 5000",
    emailTitle: "Bl-email",
    email: "hello@maltafood.experience",
    mapEyebrow: "Sibna",
    mapTitle: "Floriana, ħdejn il-Belt Valletta.",
  };

  return (
    <main>
      <section style={{ padding: "72px 32px 64px" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto" }}>
          <div className="mfe-eyebrow">{t.eyebrow}</div>
          <h1 className="mfe-h-display" style={{ marginTop: 22, maxWidth: 880 }}>{t.title}</h1>
          <p style={{ fontSize: 19, lineHeight: 1.55, color: "var(--mfe-ink-700)", marginTop: 24, maxWidth: 720 }}>{t.sub}</p>
        </div>
      </section>

      <section style={{ padding: "0 32px 96px" }}>
        <div style={{
          maxWidth: 1320, margin: "0 auto",
          display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 40, alignItems: "start"
        }} className="mfe-booking-grid">
          {/* Form */}
          <div style={{
            background: "var(--mfe-cream-50)", borderRadius: "var(--mfe-r-lg)",
            border: "1px solid var(--mfe-cream-200)", padding: 32,
          }}>
            {!sent ? (
              <form onSubmit={e => { e.preventDefault(); setSent(true); }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                  <Field label={t.fields.name} required>
                    <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="Your name" />
                  </Field>
                  <Field label={t.fields.email} required>
                    <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} placeholder="you@example.mt" />
                  </Field>
                  <Field label={t.fields.subject} full>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {t.subjects.map(s => (
                        <button
                          key={s.v}
                          type="button"
                          onClick={() => setForm({ ...form, subject: s.v })}
                          style={{
                            padding: "8px 14px", borderRadius: 999, cursor: "pointer",
                            border: "1px solid",
                            borderColor: form.subject === s.v ? "var(--mfe-green-800)" : "var(--mfe-cream-300)",
                            background: form.subject === s.v ? "var(--mfe-green-800)" : "transparent",
                            color: form.subject === s.v ? "var(--mfe-cream-50)" : "var(--mfe-ink-700)",
                            fontFamily: "var(--mfe-sans)", fontSize: 13,
                          }}
                        >{s.l}</button>
                      ))}
                    </div>
                  </Field>
                  <Field label={t.fields.message} required full>
                    <textarea required value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={6} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
                  </Field>
                </div>
                <button type="submit" className="mfe-btn mfe-btn--primary" style={{ marginTop: 24 }}>{t.send} →</button>
              </form>
            ) : (
              <div style={{ padding: "20px 0", textAlign: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: 999, margin: "0 auto 24px", background: "var(--mfe-green-100)", display: "grid", placeItems: "center", color: "var(--mfe-green-800)" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13 L10 18 L20 7" /></svg>
                </div>
                <h3 style={{ fontFamily: "var(--mfe-serif)", fontWeight: 500, fontSize: 32, color: "var(--mfe-green-900)", margin: 0 }}>{t.sentTitle}</h3>
                <p style={{ color: "var(--mfe-ink-700)", marginTop: 12, fontSize: 16 }}>{t.sentSub}</p>
                <button onClick={() => { setSent(false); setForm({ name: "", email: "", subject: "general", message: "" }); }} className="mfe-btn mfe-btn--ghost" style={{ marginTop: 20 }}>{t.sentAgain}</button>
              </div>
            )}
          </div>

          {/* Contact info */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <ContactBlock title={t.addressTitle}>
              {t.address.map((a, i) => <div key={i} style={{ fontSize: 15, color: "var(--mfe-ink-700)", lineHeight: 1.55 }}>{a}</div>)}
            </ContactBlock>
            <ContactBlock title={t.hoursTitle}>
              {t.hours.map((h, i) => <div key={i} style={{ fontFamily: "var(--mfe-mono)", fontSize: 13, color: "var(--mfe-ink-700)", padding: "3px 0" }}>{h}</div>)}
            </ContactBlock>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <ContactBlock title={t.phoneTitle}>
                <a href={`tel:${t.phone.replace(/\s/g, "")}`} style={{ color: "var(--mfe-green-800)", textDecoration: "none", fontSize: 15 }}>{t.phone}</a>
              </ContactBlock>
              <ContactBlock title={t.emailTitle}>
                <a href={`mailto:${t.email}`} style={{ color: "var(--mfe-green-800)", textDecoration: "none", fontSize: 14, wordBreak: "break-all" }}>{t.email}</a>
              </ContactBlock>
            </div>
          </aside>
        </div>
      </section>

      {/* MAP — OpenStreetMap embed (no API key) */}
      <section style={{ padding: "0 32px 96px" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
            <div>
              <div className="mfe-eyebrow">{t.mapEyebrow}</div>
              <h2 className="mfe-h-section" style={{ marginTop: 18 }}>{t.mapTitle}</h2>
            </div>
            <a
              href="https://www.openstreetmap.org/?mlat=35.8956&mlon=14.5089#map=16/35.8956/14.5089"
              target="_blank"
              rel="noopener noreferrer"
              className="mfe-btn mfe-btn--ghost"
              style={{ fontSize: 13 }}
            >Open in OpenStreetMap →</a>
          </div>
          <div style={{
            borderRadius: "var(--mfe-r-lg)", overflow: "hidden",
            border: "1px solid var(--mfe-cream-200)",
            height: 480, position: "relative", background: "var(--mfe-cream-100)",
          }}>
            <iframe
              title="Malta Food Agency — Floriana"
              src="https://www.openstreetmap.org/export/embed.html?bbox=14.4989%2C35.8896%2C14.5189%2C35.9016&layer=mapnik&marker=35.8956%2C14.5089"
              style={{ width: "100%", height: "100%", border: 0, display: "block" }}
              loading="lazy"
            />
            <div style={{
              position: "absolute", left: 24, bottom: 24,
              background: "var(--mfe-cream-50)", borderRadius: "var(--mfe-r-md)",
              padding: "16px 20px", boxShadow: "var(--mfe-shadow-md)",
              maxWidth: 280,
            }}>
              <div style={{ fontFamily: "var(--mfe-mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mfe-terra-600)" }}>Headquarters</div>
              <div style={{ fontFamily: "var(--mfe-serif)", fontSize: 20, color: "var(--mfe-green-900)", marginTop: 4 }}>Malta Food Agency</div>
              <div style={{ fontSize: 13, color: "var(--mfe-ink-700)", marginTop: 4 }}>Pjazza San Kalċidonju, Floriana</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

const ContactBlock = ({ title, children }) => (
  <div style={{
    background: "var(--mfe-cream-100)", borderRadius: "var(--mfe-r-lg)",
    padding: 24, border: "1px solid var(--mfe-cream-200)",
  }}>
    <div style={{ fontFamily: "var(--mfe-mono)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mfe-terra-600)", marginBottom: 12 }}>{title}</div>
    {children}
  </div>
);

Object.assign(window, { ContactPage });

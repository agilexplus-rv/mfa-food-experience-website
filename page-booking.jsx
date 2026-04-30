/* ========== BOOKING PAGE — calendar-first 3-step flow ========== */

const SESSIONS_BY_DATE = {
  "2026-05-09": { region: "Mġarr", topic: "Olive Oil + Bread", slots: ["10:00", "11:30", "14:00", "15:30"], spotsPerSlot: { "10:00": 6, "11:30": 0, "14:00": 12, "15:30": 8 } },
  "2026-05-10": { region: "Mosta", topic: "Honey + Citrus", slots: ["09:30", "11:00"], spotsPerSlot: { "09:30": 4, "11:00": 12 } },
  "2026-05-15": { region: "Marsaxlokk", topic: "Sea to Table", slots: ["09:30", "12:30"], spotsPerSlot: { "09:30": 8, "12:30": 6 } },
  "2026-05-17": { region: "Gozo · Xagħra", topic: "Ġbejniet Workshop", slots: ["11:00", "14:00"], spotsPerSlot: { "11:00": 3, "14:00": 9 } },
  "2026-05-22": { region: "Burmarrad", topic: "Olive Pressing", slots: ["10:00", "16:00"], spotsPerSlot: { "10:00": 12, "16:00": 4 } },
  "2026-05-23": { region: "Burmarrad", topic: "Honey + Citrus", slots: ["10:00", "16:00"], spotsPerSlot: { "10:00": 12, "16:00": 6 } },
  "2026-05-29": { region: "Qormi", topic: "Ħobż Workshop", slots: ["08:00", "10:30"], spotsPerSlot: { "08:00": 0, "10:30": 5 } },
  "2026-05-31": { region: "Marsaxlokk", topic: "Sea to Table", slots: ["09:30", "12:30"], spotsPerSlot: { "09:30": 8, "12:30": 12 } },
  "2026-06-05": { region: "Siġġiewi", topic: "Wild Capers", slots: ["08:00", "11:00"], spotsPerSlot: { "08:00": 12, "11:00": 8 } },
  "2026-06-07": { region: "Mellieħa", topic: "Tomato Harvest", slots: ["09:00", "11:30"], spotsPerSlot: { "09:00": 12, "11:30": 12 } },
  "2026-06-13": { region: "Gozo · Nadur", topic: "Wine Tasting", slots: ["17:00", "19:00"], spotsPerSlot: { "17:00": 6, "19:00": 12 } },
  "2026-06-14": { region: "Rabat", topic: "Cheese & Bread", slots: ["10:00", "13:00"], spotsPerSlot: { "10:00": 4, "13:00": 8 } },
  "2026-06-21": { region: "Mġarr", topic: "Summer Garden", slots: ["09:00", "11:30"], spotsPerSlot: { "09:00": 10, "11:30": 12 } },
};

const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monthName = (m, lang) => {
  const en = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const mt = ["Jannar","Frar","Marzu","April","Mejju","Ġunju","Lulju","Awwissu","Settembru","Ottubru","Novembru","Diċembru"];
  return (lang === "en" ? en : mt)[m];
};

const BookingPage = ({ lang }) => {
  const [step, setStep] = React.useState(1);
  const [viewMonth, setViewMonth] = React.useState(new Date(2026, 4, 1));
  const [selectedDate, setSelectedDate] = React.useState(null);
  const [selectedSlot, setSelectedSlot] = React.useState(null);
  const [form, setForm] = React.useState({ name: "", email: "", phone: "", guests: 2, dietary: "", notes: "" });
  const [submitted, setSubmitted] = React.useState(false);

  const t = lang === "en" ? {
    eyebrow: "Book a tasting",
    title: "Pick a date. Save a seat.",
    sub: "Sessions are free. Capacity is 24 per slot. You'll receive a confirmation email and a reminder 48 hours before.",
    steps: ["Date", "Time slot", "Your details"],
    next: "Continue", back: "Back", confirm: "Confirm booking",
    chooseDate: "Choose a date with available sessions",
    noSessions: "No sessions on this date.",
    fields: { name: "Full name", email: "Email", phone: "Phone (optional)", guests: "Number of guests", dietary: "Dietary requirements (optional)", notes: "Anything else?" },
    review: "Review & confirm",
    spots: "spots", soldOut: "Sold out", at: "at",
    success: "You're booked.",
    successSub: "We've sent a confirmation to",
    successTip: "We'll email a reminder 48 hours before your session. Add it to your calendar — it's a date.",
    backHome: "Back to home",
    monthsAhead: "May → September",
    legend: ["Available", "Limited", "Full", "No session"],
  } : {
    eyebrow: "Ibbukkja",
    title: "Agħżel data. Postok lest.",
    sub: "Is-sessjonijiet huma b'xejn. Massimu ta' 24 mistieden.",
    steps: ["Data", "Ħin", "Dettalji"],
    next: "Kompli", back: "Lura", confirm: "Ikkonferma",
    chooseDate: "Agħżel data b'sessjonijiet disponibbli",
    noSessions: "L-ebda sessjoni f'din id-data.",
    fields: { name: "Isem sħiħ", email: "Email", phone: "Telefon (mhux obbligatorju)", guests: "Numru ta' mistednin", dietary: "Rekwiżiti dietetiċi", notes: "Xi ħaġa oħra?" },
    review: "Iċċekkja u kkonferma",
    spots: "postijiet", soldOut: "Mimlija", at: "fil-",
    success: "Ibbukkjat.",
    successSub: "Bgħatna konferma lil",
    successTip: "Niktbulek tfakkira 48 siegħa qabel.",
    backHome: "Lura",
    monthsAhead: "Mejju → Settembru",
    legend: ["Disponibbli", "Limitat", "Mimli", "Bla sessjoni"],
  };

  if (submitted) {
    return (
      <main style={{ padding: "120px 32px", minHeight: "60vh" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <div style={{
            width: 84, height: 84, borderRadius: 999, margin: "0 auto 32px",
            background: "var(--mfe-green-100)", display: "grid", placeItems: "center",
            color: "var(--mfe-green-800)",
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13 L10 18 L20 7" />
            </svg>
          </div>
          <div className="mfe-eyebrow" style={{ justifyContent: "center" }}>Confirmed</div>
          <h1 className="mfe-h-display" style={{ marginTop: 18 }}>{t.success}</h1>
          <p style={{ fontSize: 18, color: "var(--mfe-ink-700)", marginTop: 16 }}>
            {t.successSub} <strong style={{ color: "var(--mfe-green-900)" }}>{form.email}</strong>.
          </p>
          <div style={{
            marginTop: 32, padding: 24, borderRadius: "var(--mfe-r-lg)",
            background: "var(--mfe-cream-100)", textAlign: "left",
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20,
          }}>
            <Detail label={t.fields.name.split(" ")[0]} val={form.name} />
            <Detail label="Date" val={selectedDate ? new Date(selectedDate).toDateString() : "—"} />
            <Detail label="Slot" val={selectedSlot} />
            <Detail label={t.fields.guests} val={form.guests} />
          </div>
          <p style={{ fontSize: 14, color: "var(--mfe-ink-500)", marginTop: 24 }}>{t.successTip}</p>
        </div>
      </main>
    );
  }

  const session = selectedDate ? SESSIONS_BY_DATE[selectedDate] : null;

  return (
    <main style={{ padding: "72px 32px 96px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className="mfe-eyebrow">{t.eyebrow}</div>
        <h1 className="mfe-h-display" style={{ marginTop: 22, maxWidth: 720 }}>{t.title}</h1>
        <p style={{ fontSize: 18, lineHeight: 1.55, color: "var(--mfe-ink-700)", marginTop: 20, maxWidth: 640 }}>{t.sub}</p>

        {/* Stepper */}
        <div style={{ display: "flex", gap: 0, marginTop: 48, marginBottom: 40, alignItems: "center" }}>
          {t.steps.map((s, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <React.Fragment key={s}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 999,
                    background: done ? "var(--mfe-green-800)" : active ? "var(--mfe-terra-500)" : "var(--mfe-cream-200)",
                    color: done || active ? "var(--mfe-cream-50)" : "var(--mfe-ink-500)",
                    display: "grid", placeItems: "center",
                    fontFamily: "var(--mfe-mono)", fontSize: 13, fontWeight: 600,
                  }}>
                    {done ? "✓" : n}
                  </div>
                  <span style={{
                    fontFamily: "var(--mfe-sans)", fontSize: 14, fontWeight: 500,
                    color: active || done ? "var(--mfe-green-900)" : "var(--mfe-ink-500)",
                  }}>{s}</span>
                </div>
                {i < t.steps.length - 1 && (
                  <div style={{ flex: 1, height: 1, background: "var(--mfe-cream-300)", margin: "0 18px" }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 40, alignItems: "start" }} className="mfe-booking-grid">
          {/* MAIN PANEL */}
          <div style={{
            background: "var(--mfe-cream-50)", borderRadius: "var(--mfe-r-lg)",
            border: "1px solid var(--mfe-cream-200)", padding: 32,
          }}>
            {step === 1 && (
              <CalendarStep
                viewMonth={viewMonth} setViewMonth={setViewMonth}
                selectedDate={selectedDate} setSelectedDate={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
                lang={lang} t={t}
              />
            )}
            {step === 2 && session && (
              <SlotsStep session={session} selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot} t={t} selectedDate={selectedDate} />
            )}
            {step === 2 && !session && (
              <div style={{ padding: 40, textAlign: "center", color: "var(--mfe-ink-500)" }}>{t.noSessions}</div>
            )}
            {step === 3 && (
              <DetailsStep form={form} setForm={setForm} t={t} />
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--mfe-cream-200)" }}>
              <button
                className="mfe-btn mfe-btn--ghost"
                onClick={() => setStep(step - 1)}
                disabled={step === 1}
                style={{ opacity: step === 1 ? 0.3 : 1, cursor: step === 1 ? "not-allowed" : "pointer" }}
              >← {t.back}</button>
              {step < 3 ? (
                <button
                  className="mfe-btn mfe-btn--primary"
                  disabled={(step === 1 && !selectedDate) || (step === 2 && !selectedSlot)}
                  onClick={() => setStep(step + 1)}
                  style={{
                    opacity: (step === 1 && !selectedDate) || (step === 2 && !selectedSlot) ? 0.4 : 1,
                    cursor: (step === 1 && !selectedDate) || (step === 2 && !selectedSlot) ? "not-allowed" : "pointer",
                  }}
                >{t.next} →</button>
              ) : (
                <button
                  className="mfe-btn mfe-btn--terra"
                  disabled={!form.name || !form.email}
                  onClick={() => setSubmitted(true)}
                  style={{ opacity: !form.name || !form.email ? 0.4 : 1, cursor: !form.name || !form.email ? "not-allowed" : "pointer" }}
                >{t.confirm} →</button>
              )}
            </div>
          </div>

          {/* SUMMARY PANEL */}
          <BookingSummary
            selectedDate={selectedDate}
            selectedSlot={selectedSlot}
            session={session}
            form={form}
            lang={lang}
            t={t}
          />
        </div>
      </div>
    </main>
  );
};

const CalendarStep = ({ viewMonth, setViewMonth, selectedDate, setSelectedDate, lang, t }) => {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startWeekday = (first.getDay() + 6) % 7; // monday-first
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const dayLabels = lang === "en" ? ["M", "T", "W", "T", "F", "S", "S"] : ["T", "T", "Er", "H", "Ġ", "S", "Ħ"];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div className="mfe-eyebrow">{t.chooseDate}</div>
          <h3 style={{ fontFamily: "var(--mfe-serif)", fontWeight: 500, fontSize: 28, margin: "10px 0 0", color: "var(--mfe-green-900)" }}>
            {monthName(month, lang)} {year}
          </h3>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <CalNavBtn onClick={() => setViewMonth(new Date(year, month - 1, 1))} disabled={month <= 4 && year <= 2026}>←</CalNavBtn>
          <CalNavBtn onClick={() => setViewMonth(new Date(year, month + 1, 1))} disabled={month >= 8 && year >= 2026}>→</CalNavBtn>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 12 }}>
        {dayLabels.map((d, i) => (
          <div key={i} style={{
            textAlign: "center", fontFamily: "var(--mfe-mono)", fontSize: 11,
            letterSpacing: "0.14em", color: "var(--mfe-ink-500)", padding: "6px 0",
          }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const ds = fmtDate(d);
          const session = SESSIONS_BY_DATE[ds];
          const totalSpots = session ? Object.values(session.spotsPerSlot).reduce((a, b) => a + b, 0) : 0;
          const status = !session ? "none" : totalSpots === 0 ? "full" : totalSpots <= 6 ? "limited" : "available";
          const isSelected = selectedDate === ds;
          return (
            <button
              key={i}
              onClick={() => session && status !== "full" && setSelectedDate(ds)}
              disabled={!session || status === "full"}
              style={{
                aspectRatio: "1/1", borderRadius: "var(--mfe-r-md)",
                border: isSelected ? "2px solid var(--mfe-terra-500)" : "1px solid var(--mfe-cream-200)",
                background: isSelected ? "rgba(217,119,87,0.1)" :
                  status === "available" ? "var(--mfe-cream-50)" :
                  status === "limited" ? "rgba(216,182,101,0.18)" :
                  status === "full" ? "var(--mfe-cream-200)" :
                  "transparent",
                cursor: !session || status === "full" ? "not-allowed" : "pointer",
                position: "relative", padding: 8,
                display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "stretch",
                color: status === "none" ? "var(--mfe-ink-300)" : "var(--mfe-green-900)",
              }}
            >
              <span style={{ fontFamily: "var(--mfe-serif)", fontSize: 18, alignSelf: "flex-start" }}>{d.getDate()}</span>
              {session && (
                <span style={{ fontFamily: "var(--mfe-mono)", fontSize: 9, letterSpacing: "0.08em", textAlign: "left", lineHeight: 1.2,
                  color: status === "full" ? "var(--mfe-ink-500)" : "var(--mfe-terra-600)"
                }}>{session.region}</span>
              )}
              {status !== "none" && (
                <span style={{
                  position: "absolute", top: 8, right: 8,
                  width: 6, height: 6, borderRadius: 999,
                  background: status === "available" ? "var(--mfe-green-600)" : status === "limited" ? "var(--mfe-gold-600)" : "var(--mfe-ink-300)",
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 20, marginTop: 24, fontSize: 12, color: "var(--mfe-ink-500)", flexWrap: "wrap" }}>
        {[
          { c: "var(--mfe-green-600)", l: t.legend[0] },
          { c: "var(--mfe-gold-600)", l: t.legend[1] },
          { c: "var(--mfe-ink-300)", l: t.legend[2] },
        ].map((x) => (
          <span key={x.l} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--mfe-mono)", letterSpacing: "0.08em" }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: x.c }} />{x.l}
          </span>
        ))}
      </div>
    </div>
  );
};

const CalNavBtn = ({ children, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width: 36, height: 36, borderRadius: 999,
    border: "1px solid var(--mfe-cream-300)",
    background: "var(--mfe-cream-50)", cursor: disabled ? "not-allowed" : "pointer",
    color: "var(--mfe-green-900)", fontSize: 16,
    opacity: disabled ? 0.3 : 1,
  }}>{children}</button>
);

const SlotsStep = ({ session, selectedSlot, setSelectedSlot, t, selectedDate }) => {
  const d = new Date(selectedDate);
  return (
    <div>
      <div className="mfe-eyebrow">{session.topic}</div>
      <h3 style={{ fontFamily: "var(--mfe-serif)", fontWeight: 500, fontSize: 28, margin: "10px 0 6px", color: "var(--mfe-green-900)" }}>
        {session.region}
      </h3>
      <p style={{ color: "var(--mfe-ink-500)", marginBottom: 28, fontSize: 14 }}>
        {d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {session.slots.map(s => {
          const spots = session.spotsPerSlot[s];
          const isSold = spots === 0;
          const active = selectedSlot === s;
          return (
            <button
              key={s}
              onClick={() => !isSold && setSelectedSlot(s)}
              disabled={isSold}
              style={{
                padding: "20px 18px", borderRadius: "var(--mfe-r-md)",
                border: active ? "2px solid var(--mfe-terra-500)" : "1px solid var(--mfe-cream-300)",
                background: active ? "rgba(217,119,87,0.08)" : isSold ? "var(--mfe-cream-200)" : "var(--mfe-cream-50)",
                cursor: isSold ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                opacity: isSold ? 0.55 : 1,
              }}
            >
              <span style={{ fontFamily: "var(--mfe-serif)", fontSize: 24, color: "var(--mfe-green-900)" }}>{s}</span>
              <span style={{ fontFamily: "var(--mfe-mono)", fontSize: 12, color: isSold ? "var(--mfe-ink-500)" : "var(--mfe-ink-700)" }}>
                {isSold ? t.soldOut : `${spots} ${t.spots}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const DetailsStep = ({ form, setForm, t }) => {
  const update = (k, v) => setForm({ ...form, [k]: v });
  return (
    <div>
      <div className="mfe-eyebrow">{t.review}</div>
      <h3 style={{ fontFamily: "var(--mfe-serif)", fontWeight: 500, fontSize: 28, margin: "10px 0 28px", color: "var(--mfe-green-900)" }}>
        Your details
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <Field label={t.fields.name} required>
          <input type="text" value={form.name} onChange={e => update("name", e.target.value)} style={inputStyle} placeholder="Anna Camilleri" />
        </Field>
        <Field label={t.fields.email} required>
          <input type="email" value={form.email} onChange={e => update("email", e.target.value)} style={inputStyle} placeholder="anna@example.mt" />
        </Field>
        <Field label={t.fields.phone}>
          <input type="tel" value={form.phone} onChange={e => update("phone", e.target.value)} style={inputStyle} placeholder="+356 ..." />
        </Field>
        <Field label={t.fields.guests}>
          <select value={form.guests} onChange={e => update("guests", e.target.value)} style={inputStyle}>
            {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field label={t.fields.dietary} full>
          <input type="text" value={form.dietary} onChange={e => update("dietary", e.target.value)} style={inputStyle} placeholder="Vegetarian, allergies..." />
        </Field>
        <Field label={t.fields.notes} full>
          <textarea value={form.notes} onChange={e => update("notes", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </Field>
      </div>
    </div>
  );
};

const Field = ({ label, children, required, full }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 8, gridColumn: full ? "1 / -1" : "auto" }}>
    <span style={{ fontFamily: "var(--mfe-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mfe-ink-500)" }}>
      {label} {required && <span style={{ color: "var(--mfe-terra-600)" }}>*</span>}
    </span>
    {children}
  </label>
);

const inputStyle = {
  padding: "12px 14px",
  borderRadius: "var(--mfe-r-sm)",
  border: "1px solid var(--mfe-cream-300)",
  background: "var(--mfe-cream-50)",
  fontFamily: "var(--mfe-sans)", fontSize: 15,
  color: "var(--mfe-ink-900)",
  outline: "none",
};

const BookingSummary = ({ selectedDate, selectedSlot, session, form, lang, t }) => {
  const d = selectedDate ? new Date(selectedDate) : null;
  return (
    <aside style={{
      position: "sticky", top: 100,
      background: "var(--mfe-green-900)", color: "var(--mfe-cream-50)",
      borderRadius: "var(--mfe-r-lg)", padding: 28,
      overflow: "hidden", position: "relative",
    }}>
      <svg width="100%" height="100%" viewBox="0 0 400 600" preserveAspectRatio="none" style={{
        position: "absolute", inset: 0, opacity: 0.2, pointerEvents: "none"
      }}>
        <path d="M 380 -50 Q 280 250 420 500" stroke="var(--mfe-terra-400)" strokeWidth="1" fill="none" />
        <path d="M 420 -20 Q 320 280 460 520" stroke="var(--mfe-gold-500)" strokeWidth="1" fill="none" />
      </svg>
      <div style={{ position: "relative" }}>
        <div className="mfe-eyebrow" style={{ color: "var(--mfe-gold-500)" }}>Your booking</div>
        <h3 style={{ fontFamily: "var(--mfe-serif)", fontWeight: 500, fontSize: 24, margin: "12px 0 28px" }}>
          {session ? session.topic : "—"}
        </h3>
        <SummaryRow label="Date" val={d ? d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : "—"} />
        <SummaryRow label="Region" val={session ? session.region : "—"} />
        <SummaryRow label="Time" val={selectedSlot || "—"} />
        <SummaryRow label="Guests" val={form.guests || "—"} />
        <hr style={{ border: 0, borderTop: "1px solid rgba(250,246,238,0.15)", margin: "20px 0" }} />
        <SummaryRow label="Cost" val={<span style={{ color: "var(--mfe-gold-500)", fontFamily: "var(--mfe-serif)", fontSize: 22 }}>Free</span>} />
        <p style={{ fontSize: 12, color: "rgba(250,246,238,0.6)", marginTop: 16, lineHeight: 1.5 }}>
          A confirmation email is sent automatically on booking. We'll remind you 48 hours before.
        </p>
      </div>
    </aside>
  );
};

const SummaryRow = ({ label, val }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0" }}>
    <span style={{ fontFamily: "var(--mfe-mono)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(250,246,238,0.6)" }}>{label}</span>
    <span style={{ fontFamily: "var(--mfe-sans)", fontSize: 14, color: "var(--mfe-cream-50)" }}>{val}</span>
  </div>
);

const Detail = ({ label, val }) => (
  <div>
    <div style={{ fontFamily: "var(--mfe-mono)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mfe-ink-500)" }}>{label}</div>
    <div style={{ fontFamily: "var(--mfe-serif)", fontSize: 18, color: "var(--mfe-green-900)", marginTop: 4 }}>{val}</div>
  </div>
);

Object.assign(window, { BookingPage });

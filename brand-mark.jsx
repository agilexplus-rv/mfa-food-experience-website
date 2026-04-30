/* Malta Food Experience logo mark — circular bowl + flame, original interpretation */
const BrandMark = ({ size = 36, color = "currentColor", flameColor }) => {
  const fc = flameColor || "var(--mfe-terra-500)";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="30" stroke={color} strokeWidth="2" fill="none" />
      {/* Bowl */}
      <path
        d="M16 38 Q32 50 48 38 L46 42 Q32 53 18 42 Z"
        fill={color}
        opacity="0.95"
      />
      <path
        d="M14 36 H50"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Flame / steam wisps */}
      <path
        d="M26 30 Q22 22 28 14 Q30 22 28 28"
        fill={fc}
        opacity="0.85"
      />
      <path
        d="M34 30 Q30 20 36 10 Q40 20 36 28"
        fill={fc}
      />
      <path
        d="M42 30 Q40 24 44 18 Q46 24 44 28"
        fill={fc}
        opacity="0.7"
      />
    </svg>
  );
};

const BrandLockup = ({ tone = "dark", compact = false }) => {
  const h = compact ? 40 : 52;
  const src = tone === "light"
    ? "assets/malta-food-footer.png"             // inverted lockup, dark-green knockout transparent
    : "assets/malta-food-logo-transparent.png";  // colored mark for cream nav (untouched)
  return (
    <span className="mfe-mark" style={{ display: "inline-flex", alignItems: "center" }}>
      <img
        src={src}
        alt="Malta Food Experience"
        style={{ height: h, width: "auto", display: "block" }}
      />
    </span>
  );
};

Object.assign(window, { BrandMark, BrandLockup });

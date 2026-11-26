export default function GarageScene() {
  return (
    <div className="gscene" aria-label="Animated illustration: Grok Bot agents pricing items at a garage sale">
      <svg viewBox="0 0 800 260" preserveAspectRatio="xMidYMax slice" role="img">
        <defs>
          <linearGradient id="gs-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b1220" /><stop offset="1" stopColor="#050506" /></linearGradient>
          <linearGradient id="gs-door" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a1d24" /><stop offset="1" stopColor="#0c0d10" /></linearGradient>
        </defs>
        <rect width="800" height="260" fill="url(#gs-sky)" />
        <path d="M40 120 L190 60 L340 120 Z" fill="#1c1f26" />
        <rect x="60" y="120" width="260" height="110" fill="#15171c" />
        <rect x="90" y="140" width="200" height="90" fill="url(#gs-door)" />
        <g className="gs-door-lines" stroke="#22262e" strokeWidth="2">{[0, 1, 2, 3].map((i) => <line key={i} x1="90" x2="290" y1={140 + i * 6} y2={140 + i * 6} />)}</g>
        <rect x="160" y="96" width="60" height="14" rx="3" fill="#0866ff" /><text x="190" y="107" textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff">SALE</text>
        <path d="M90 230 L290 230 L330 260 L50 260 Z" fill="#101114" />
        <rect x="0" y="230" width="800" height="30" fill="#0b0c0e" />
        {[[380, 'a'], [560, 'b']].map(([x, k]) => (
          <g key={k}>
            <rect x={x} y="196" width="150" height="8" rx="2" fill="#2a2d35" />
            <rect x={x + 10} y="204" width="5" height="26" fill="#22252c" /><rect x={x + 135} y="204" width="5" height="26" fill="#22252c" />
          </g>
        ))}
        <rect x="392" y="176" width="26" height="20" rx="3" fill="#3a6ea5" /><circle cx="440" cy="186" r="10" fill="#c9a227" /><rect x="462" y="168" width="14" height="28" rx="2" fill="#8a5a3c" /><rect x="486" y="180" width="30" height="16" rx="3" fill="#5b616e" />
        <rect x="572" y="172" width="22" height="24" rx="3" fill="#a0522d" /><rect x="604" y="182" width="34" height="14" rx="3" fill="#2f7d5a" /><circle cx="656" cy="184" r="12" fill="#7a7f8c" /><rect x="676" y="176" width="20" height="20" rx="4" fill="#b04a5a" />
        <g className="gs-sold"><g transform="translate(656 150)"><rect x="-26" y="-11" width="52" height="22" rx="5" fill="#30d158" /><text y="5" textAnchor="middle" fontSize="13" fontWeight="900" fill="#04210f">SOLD</text></g></g>
        <g className="gs-sold gs-sold2"><g transform="translate(440 150)"><rect x="-26" y="-11" width="52" height="22" rx="5" fill="#30d158" /><text y="5" textAnchor="middle" fontSize="13" fontWeight="900" fill="#04210f">SOLD</text></g></g>
        {[0, 1, 2, 3].map((i) => (
          <g key={i} className={`gs-bot gs-bot${i}`}>
            <g className="gs-bob">
              <ellipse cx="0" cy="30" rx="11" ry="3" fill="#000" opacity=".5" />
              <rect x="-9" y="2" width="18" height="24" rx="8" fill="#1d2433" />
              <circle cx="0" cy="-6" r="11" fill="#0866ff" />
              <text y="-2" textAnchor="middle" fontSize="11" fontWeight="900" fill="#fff">G</text>
              <g transform="translate(12 6) rotate(-12)"><rect width="22" height="13" rx="3" fill="#fff" /><text x="11" y="10" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#0b0c0e">${['40', '15', '120', '65'][i]}</text></g>
            </g>
          </g>
        ))}
      </svg>
      <p className="gcap">Grok Bot agents price every item, list it, and handle buyers. Illustration.</p>
    </div>
  );
}

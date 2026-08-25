/* Bağımlılıksız SVG kilo grafiği */

const Chart = {
  render(host, weights, goal, rangeDays) {
    if (!weights.length) {
      host.innerHTML = '<div class="chart-empty">Henüz veri yok.<br>İlk tartını gir, grafik burada oluşur.</div>';
      return;
    }

    let pts = weights.slice();
    if (rangeDays > 0) {
      const cutoff = dateKey(new Date(Date.now() - rangeDays * 86400000));
      const filtered = pts.filter(p => p.d >= cutoff);
      if (filtered.length >= 2) pts = filtered;
    }
    if (pts.length === 1) pts = [pts[0], pts[0]];

    const W = 340, H = 190;
    const padL = 34, padR = 10, padT = 12, padB = 24;
    const iw = W - padL - padR, ih = H - padT - padB;

    const trend = Calc.trend(pts);
    const values = pts.map(p => p.kg).concat(trend.map(p => p.kg));
    let min = Math.min(...values), max = Math.max(...values);
    const showGoal = goal >= min - 12 && goal <= max + 12;
    if (showGoal) { min = Math.min(min, goal); max = Math.max(max, goal); }
    const span = Math.max(1.5, max - min);
    min -= span * 0.12; max += span * 0.12;

    const t0 = parseKey(pts[0].d).getTime();
    const t1 = parseKey(pts[pts.length - 1].d).getTime();
    const tspan = Math.max(1, t1 - t0);
    const x = p => padL + ((parseKey(p.d).getTime() - t0) / tspan) * iw;
    const y = v => padT + (1 - (v - min) / (max - min)) * ih;

    const line = arr => arr.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
    const area = arr => line(arr) + ` L${x(arr[arr.length - 1]).toFixed(1)},${(padT + ih).toFixed(1)} L${x(arr[0]).toFixed(1)},${(padT + ih).toFixed(1)} Z`;

    // Y ekseni: 4 çizgi
    let grid = '';
    for (let i = 0; i <= 3; i++) {
      const v = min + (max - min) * (i / 3);
      const yy = y(v).toFixed(1);
      grid += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="#252d3a" stroke-width="1"/>`;
      grid += `<text x="${padL - 6}" y="${+yy + 3.5}" fill="#5f6b7d" font-size="9.5" text-anchor="end">${v.toFixed(0)}</text>`;
    }

    // X ekseni: baş / orta / son tarih
    const fmt = k => {
      const d = parseKey(k);
      return `${d.getDate()} ${['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'][d.getMonth()]}`;
    };
    const mid = pts[Math.floor(pts.length / 2)];
    let xlab = `<text x="${padL}" y="${H - 6}" fill="#5f6b7d" font-size="9.5">${fmt(pts[0].d)}</text>`;
    if (pts.length > 3) xlab += `<text x="${x(mid).toFixed(1)}" y="${H - 6}" fill="#5f6b7d" font-size="9.5" text-anchor="middle">${fmt(mid.d)}</text>`;
    xlab += `<text x="${W - padR}" y="${H - 6}" fill="#5f6b7d" font-size="9.5" text-anchor="end">${fmt(pts[pts.length - 1].d)}</text>`;

    const goalLine = showGoal
      ? `<line x1="${padL}" y1="${y(goal).toFixed(1)}" x2="${W - padR}" y2="${y(goal).toFixed(1)}" stroke="#58a6ff" stroke-width="1.5" stroke-dasharray="4 4" opacity=".8"/>
         <text x="${W - padR}" y="${(y(goal) - 5).toFixed(1)}" fill="#58a6ff" font-size="9.5" text-anchor="end">hedef ${goal}</text>`
      : '';

    const last = pts[pts.length - 1];
    const dots = pts.length <= 60
      ? pts.map(p => `<circle cx="${x(p).toFixed(1)}" cy="${y(p.kg).toFixed(1)}" r="2" fill="#5f6b7d"/>`).join('')
      : '';

    host.innerHTML = `
<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kilo grafiği">
  <defs>
    <linearGradient id="gfill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3fb950" stop-opacity=".28"/>
      <stop offset="100%" stop-color="#3fb950" stop-opacity="0"/>
    </linearGradient>
  </defs>
  ${grid}
  ${goalLine}
  <path d="${area(trend)}" fill="url(#gfill)"/>
  <path d="${line(pts)}" fill="none" stroke="#5f6b7d" stroke-width="1.2" opacity=".65" stroke-linejoin="round"/>
  ${dots}
  <path d="${line(trend)}" fill="none" stroke="#3fb950" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${x(last).toFixed(1)}" cy="${y(last.kg).toFixed(1)}" r="4.5" fill="#3fb950" stroke="#0d1117" stroke-width="2"/>
  ${xlab}
</svg>`;
  }
};

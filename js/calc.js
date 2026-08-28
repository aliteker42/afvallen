/* Hesaplar: BMI, TDEE, trend, tahmin, kilometre taşları */

const Calc = {
  bmi(kg, cm) {
    if (!kg || !cm) return 0;
    return kg / Math.pow(cm / 100, 2);
  },

  bmiTag(b) {
    if (b < 25) return { text: 'normal', cls: 'ok' };
    if (b < 30) return { text: 'fazla kilolu', cls: 'mid' };
    if (b < 35) return { text: 'obez I', cls: 'bad' };
    if (b < 40) return { text: 'obez II', cls: 'bad' };
    return { text: 'obez III', cls: 'bad' };
  },

  /* Mifflin-St Jeor */
  bmr(kg, cm, age, sex) {
    const base = 10 * kg + 6.25 * cm - 5 * age;
    return Math.round(base + (sex === 'm' ? 5 : -161));
  },

  tdee(kg, p) {
    return Math.round(this.bmr(kg, p.heightCm, p.age, p.sex) * (p.activity || 1.375));
  },

  /* Agresif ama güvenli hedef: TDEE - 1000, ama BMR'ın altına inme,
     ve mutlak taban 1500 (erkek) / 1300 (kadın) */
  suggestKcal(kg, p) {
    const tdee = this.tdee(kg, p);
    const bmr = this.bmr(kg, p.heightCm, p.age, p.sex);
    const floor = p.sex === 'm' ? 1500 : 1300;
    return Math.max(floor, Math.min(tdee - 1000, Math.round(bmr * 0.95)));
  },

  /* Yüksek protein: kas koru, tokluk sağla. Hedef kiloya göre 1.6 g/kg */
  suggestProtein(goalKg) {
    return Math.round((goalKg || 100) * 1.6);
  },

  /* 7 günlük hareketli ortalama — günlük su dalgalanmasını süzer */
  trend(weights, window) {
    window = window || 7;
    return weights.map((w, i) => {
      const from = Math.max(0, i - window + 1);
      const slice = weights.slice(from, i + 1);
      const avg = slice.reduce((s, x) => s + x.kg, 0) / slice.length;
      return { d: w.d, kg: avg };
    });
  },

  /* Son n gündeki değişim (trend üzerinden, gürültüsüz) */
  changeOver(weights, days) {
    if (weights.length < 2) return null;
    const tr = this.trend(weights);
    const last = tr[tr.length - 1];
    const cutoff = dateKey(new Date(parseKey(last.d).getTime() - days * 86400000));
    let ref = null;
    for (const p of tr) { if (p.d <= cutoff) ref = p; }
    if (!ref) ref = tr[0];
    if (ref.d === last.d) return null;
    return +(last.kg - ref.kg).toFixed(1);
  },

  /* Günlük kg/gün hızı — son 14 günün trendinden */
  ratePerDay(weights) {
    if (weights.length < 4) return null;
    const tr = this.trend(weights);
    const last = tr[tr.length - 1];
    const cutoff = dateKey(new Date(parseKey(last.d).getTime() - 14 * 86400000));
    let ref = null;
    for (const p of tr) { if (p.d <= cutoff) ref = p; }
    if (!ref) ref = tr[0];
    const days = daysBetween(ref.d, last.d);
    if (days < 3) return null;
    return (last.kg - ref.kg) / days;
  },

  /* Hedef kaloriden beklenen haftalık kayıp (7700 kcal ≈ 1 kg yağ) */
  expectedWeeklyLoss(kg, p, targetKcal) {
    const deficit = this.tdee(kg, p) - targetKcal;
    return +(deficit * 7 / 7700).toFixed(2);
  },

  /* Bir hedef kiloya kaç gün — önce gerçek hız, yoksa beklenen hız */
  etaDays(weights, fromKg, toKg, p, targetKcal) {
    const need = fromKg - toKg;
    if (need <= 0) return 0;
    let rate = this.ratePerDay(weights);
    if (rate === null || rate >= -0.005) {
      const weekly = this.expectedWeeklyLoss(fromKg, p, targetKcal);
      rate = weekly > 0 ? -weekly / 7 : null;
    }
    if (rate === null || rate >= 0) return null;
    return Math.ceil(need / Math.abs(rate));
  },

  /* Kilometre taşları: başlangıç ile hedef arasındaki anlamlı duraklar */
  milestones(p, weights) {
    const start = p.startWeight;
    const goal = p.goalWeight;
    const marks = [];
    const candidates = Object.keys(MILESTONE_NOTES).map(Number).sort((a, b) => b - a);

    // 5'in katları + özel notlu rakamlar
    const set = new Set(candidates);
    for (let w = Math.floor(start / 5) * 5; w >= Math.floor(goal); w -= 5) set.add(w);

    // Sadece bu yolculukta kaydedilen kilolar sayılır — eski rekor ayrı bir hedeftir
    const lowestEver = weights.length ? Math.min(...weights.map(w => w.kg)) : start;

    Array.from(set).sort((a, b) => b - a).forEach(w => {
      if (w >= start || w < goal - 0.001) return;
      marks.push({
        kg: w,
        note: MILESTONE_NOTES[w] || `${w} kg — başlangıçtan ${(start - w).toFixed(1)} kg aşağıda.`,
        done: lowestEver <= w
      });
    });
    return marks;
  },

  nextMilestone(p, weights) {
    const cur = weights.length ? weights[weights.length - 1].kg : p.startWeight;
    const ms = this.milestones(p, weights);
    for (const m of ms) { if (m.kg < cur) return m; }
    return null;
  },

  /* Bir öğünün etkisini insan diline çevir */
  mealImpact(kcal, kg, p, targetKcal, consumedToday) {
    const tdee = this.tdee(kg, p);
    const after = consumedToday + kcal;
    const deficit = tdee - after;
    const fatKg = kcal / 7700;
    return {
      tdee,
      after,
      deficit,
      overBy: Math.max(0, after - targetKcal),
      fatKg: +fatKg.toFixed(3),
      // Fazla kalorinin kaç dakikalık yürüyüşe denk geldiği (~4 kcal/dk)
      walkMin: Math.round(kcal / 4),
      killsDeficit: deficit <= 0
    };
  }
};

/* Koç cümleleri: tona göre seç, yer tutucuları doldur */

const Coach = {
  pick(kind) {
    const p = Store.data.profile;
    const tone = COACH[p.tone] ? p.tone : 'koc';
    const pool = COACH[tone][kind] || COACH[tone].idle;
    const raw = pool[Math.floor(Math.random() * pool.length)];
    return this.fill(raw);
  },

  fill(s, extra) {
    const p = Store.data.profile;
    const w = Store.data.weights;
    const kg = Store.currentKg();
    const t = Store.data.targets;
    const next = Calc.nextMilestone(p, w);
    const kalan = Math.max(0, kg - p.goalWeight);
    const weekly = Calc.expectedWeeklyLoss(kg, p, t.kcal);
    const vals = Object.assign({
      kg: kg.toFixed(1),
      kalan: kalan.toFixed(1),
      rekor: p.recordLow,
      bmi: Calc.bmi(kg, p.heightCm).toFixed(1),
      bmigoal: Calc.bmi(p.goalWeight, p.heightCm).toFixed(1),
      tdee: Calc.tdee(kg, p),
      hedefkcal: t.kcal,
      hafta: weekly > 0 ? Math.ceil(kalan / weekly) : '—',
      sonraki: next ? next.kg : p.goalWeight,
      d7: fmtDelta(Calc.changeOver(w, 7)),
      d30: fmtDelta(Calc.changeOver(w, 30))
    }, extra || {});
    return s.replace(/\{(\w+)\}/g, (m, k) => (vals[k] !== undefined ? vals[k] : m));
  },

  /* Tartı sonrası tepki */
  onWeighIn(prevKg, newKg) {
    if (prevKg == null) return this.pick('idle');
    const diff = +(newKg - prevKg).toFixed(1);
    if (diff <= -0.1) return this.fill(this.pickRaw('loss'), { fark: Math.abs(diff).toFixed(1) });
    if (diff >= 0.1) return this.fill(this.pickRaw('gain'), { fark: diff.toFixed(1) });
    return this.pick('idle');
  },

  pickRaw(kind) {
    const tone = COACH[Store.data.profile.tone] ? Store.data.profile.tone : 'koc';
    const pool = COACH[tone][kind] || COACH[tone].idle;
    return pool[Math.floor(Math.random() * pool.length)];
  },

  /* Fotoğraf/öğün analizinden sonra somut sonuç cümlesi */
  verdict(imp, name) {
    const tone = Store.data.profile.tone;
    const kcal = Math.round(imp.kcal);
    const tartiEtkisi = (imp.fatKg).toFixed(2);

    if (tone === 'soguk') {
      return `${kcal} kcal. Günlük toplam ${imp.after}/${Store.data.targets.kcal}. ` +
        (imp.killsDeficit
          ? `Açık kapandı (yakım ${imp.tdee}). Net yağ etkisi ≈ +${tartiEtkisi} kg.`
          : `Kalan açık ${imp.deficit} kcal.`) +
        ` Dengelemek için ≈ ${imp.walkMin} dk yürüyüş.`;
    }

    if (tone === 'sert') {
      if (imp.killsDeficit) {
        return `${kcal} kcal. Bugünkü açığın bitti — bugün boşa gitti. Bunu telafi etmek ${imp.walkMin} dakika yürümek demek. Yürüyecek misin, yoksa yarın terazide mi göreceğiz?`;
      }
      if (imp.overBy > 0) {
        return `${kcal} kcal, hedefi ${imp.overBy} kcal aştın. Her seferinde "bir kereden bir şey olmaz" dedin, bir yılda 23 kg oldu.`;
      }
      return `${kcal} kcal. Hedefin içindesin. Ama gün bitmedi, akşamı da atlat.`;
    }

    // koç
    if (imp.killsDeficit) {
      return `${kcal} kcal — bu öğün bugünkü açığı kapatıyor. Yarım porsiyon yesen ${Math.round(kcal / 2)} kcal'da kalırdın ve gün kurtulurdu. Yediysen de dünya yıkılmadı: bu akşam ${imp.walkMin} dakika yürü, başa baş gel.`;
    }
    if (imp.overBy > 0) {
      return `${kcal} kcal. Günlük hedefi ${imp.overBy} kcal aşıyorsun — yanına protein koy, tatlıyı bırak, ${Math.round(imp.walkMin / 2)} dakika yürü, gün hâlâ iyi biter.`;
    }
    return `${kcal} kcal — hedefin içinde kalıyorsun. Doğru öğün. Yanına 1 bardak su ekle, tokluk uzasın.`;
  }
};

function fmtDelta(v) {
  if (v === null || v === undefined) return '—';
  return (v > 0 ? '+' : '') + v.toFixed(1);
}

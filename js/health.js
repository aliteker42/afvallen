/* Sağlık: kilo kaybının tansiyon, uyku ve nefeste ne açtığı.
   Hiçbir ölçüm istenmez — her şey kilodan hesaplanır. */

const Health = {
  lost(profile, weights) {
    const start = profile.startWeight;
    const cur = weights.length ? weights[weights.length - 1].kg : start;
    return Math.max(0, start - cur);
  },

  need(step, start) {
    return +(step.kg !== undefined ? step.kg : start * step.pct / 100).toFixed(1);
  },

  /* Her dert için: adımlar, tamamlanan sayısı, sıradaki adım */
  tracks(profile, weights) {
    const start = profile.startWeight;
    const lost = this.lost(profile, weights);

    return HEALTH_TRACKS.map(tr => {
      const steps = tr.steps
        .map(st => {
          const need = this.need(st, start);
          return {
            need,
            text: st.t,
            done: lost >= need - 0.001,
            remaining: +Math.max(0, need - lost).toFixed(1)
          };
        })
        .sort((a, b) => a.need - b.need);

      const done = steps.filter(s => s.done).length;
      return {
        id: tr.id,
        icon: tr.icon,
        title: tr.title,
        lead: tr.lead,
        steps,
        done,
        total: steps.length,
        next: steps.find(s => !s.done) || null
      };
    });
  },

  /* Bugün ekranındaki teaser: en yakın kazanım hangisiyse o */
  nextGain(profile, weights) {
    let best = null;
    this.tracks(profile, weights).forEach(tr => {
      if (tr.next && (!best || tr.next.remaining < best.remaining)) {
        best = { icon: tr.icon, track: tr.title, text: tr.next.text, remaining: tr.next.remaining, need: tr.next.need };
      }
    });
    return best;
  },

  /* Şu ana kadar kazanılanların özeti */
  summary(profile, weights) {
    const lost = this.lost(profile, weights);
    const tracks = this.tracks(profile, weights);
    return {
      lost: +lost.toFixed(1),
      sysDrop: Math.round(lost),          // ~1 mmHg / kg
      kneeLoad: Math.round(lost * 4),     // her adımda kalkan yük
      unlocked: tracks.reduce((a, t) => a + t.done, 0),
      total: tracks.reduce((a, t) => a + t.total, 0)
    };
  }
};

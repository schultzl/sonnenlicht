export const fmtGrams = (g) => `${g.toLocaleString('de-DE')} g`

export const fmtDate = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

// "45 min", "1,5 h", or a range of either
export function fmtMinutes(min) {
  if (min < 60) return `${min} min`
  const h = min / 60
  return `${h.toLocaleString('de-DE', { maximumFractionDigits: 1 })} h`
}

export const fmtMinutesRange = (lo, hi) =>
  lo >= 60 && hi >= 60
    ? `${(lo / 60).toLocaleString('de-DE', { maximumFractionDigits: 1 })}–${fmtMinutes(hi)}`
    : `${fmtMinutes(lo)} – ${fmtMinutes(hi)}`

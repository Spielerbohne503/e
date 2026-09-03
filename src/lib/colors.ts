/**
 * The eight person colours from the design doc. Deliberately different in
 * lightness so they stay distinguishable with a colour vision deficiency —
 * and a person always carries their initial as well, never colour alone.
 */
export const MEMBER_COLORS = [
  '#00B37E',
  '#7C5CFF',
  '#FF6B4A',
  '#2E9BD6',
  '#E2761B',
  '#D4467F',
  '#4C8C3A',
  '#5A6B66',
] as const

export type MemberColor = (typeof MEMBER_COLORS)[number]

/** Picks the next unused colour, wrapping around once all eight are taken. */
export function nextColor(used: string[]): string {
  const free = MEMBER_COLORS.find((c) => !used.includes(c))
  return free ?? MEMBER_COLORS[used.length % MEMBER_COLORS.length]!
}

/** First grapheme of the name, uppercased. Emoji-safe. */
export function initial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const [first] = Array.from(trimmed)
  return (first ?? '?').toUpperCase()
}

/**
 * Black or white text on a given background, chosen by relative luminance
 * so the label always clears contrast requirements.
 */
export function textOn(hex: string): string {
  const h = hex.replace('#', '')
  const to = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const luminance = 0.2126 * lin(to(0)) + 0.7152 * lin(to(2)) + 0.0722 * lin(to(4))
  return luminance > 0.45 ? '#17211E' : '#FFFFFF'
}

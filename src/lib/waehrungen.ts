/**
 * Currency list for the picker. Searchable by ISO code, German name,
 * English name and symbol, per the design.
 */

export interface Waehrung {
  code: string
  de: string
  en: string
  symbol: string
}

export const WAEHRUNGEN: Waehrung[] = [
  { code: 'EUR', de: 'Euro', en: 'Euro', symbol: '€' },
  { code: 'CHF', de: 'Schweizer Franken', en: 'Swiss Franc', symbol: 'CHF' },
  { code: 'USD', de: 'US-Dollar', en: 'US Dollar', symbol: '$' },
  { code: 'GBP', de: 'Britisches Pfund', en: 'British Pound', symbol: '£' },
  { code: 'DKK', de: 'Dänische Krone', en: 'Danish Krone', symbol: 'kr' },
  { code: 'SEK', de: 'Schwedische Krone', en: 'Swedish Krona', symbol: 'kr' },
  { code: 'NOK', de: 'Norwegische Krone', en: 'Norwegian Krone', symbol: 'kr' },
  { code: 'ISK', de: 'Isländische Krone', en: 'Icelandic Króna', symbol: 'kr' },
  { code: 'PLN', de: 'Polnischer Zloty', en: 'Polish Zloty', symbol: 'zł' },
  { code: 'CZK', de: 'Tschechische Krone', en: 'Czech Koruna', symbol: 'Kč' },
  { code: 'HUF', de: 'Ungarischer Forint', en: 'Hungarian Forint', symbol: 'Ft' },
  { code: 'RON', de: 'Rumänischer Leu', en: 'Romanian Leu', symbol: 'lei' },
  { code: 'BGN', de: 'Bulgarischer Lew', en: 'Bulgarian Lev', symbol: 'лв' },
  { code: 'HRK', de: 'Kroatische Kuna', en: 'Croatian Kuna', symbol: 'kn' },
  { code: 'RSD', de: 'Serbischer Dinar', en: 'Serbian Dinar', symbol: 'дин' },
  { code: 'TRY', de: 'Türkische Lira', en: 'Turkish Lira', symbol: '₺' },
  { code: 'UAH', de: 'Ukrainische Hrywnja', en: 'Ukrainian Hryvnia', symbol: '₴' },
  { code: 'RUB', de: 'Russischer Rubel', en: 'Russian Ruble', symbol: '₽' },
  { code: 'CAD', de: 'Kanadischer Dollar', en: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', de: 'Australischer Dollar', en: 'Australian Dollar', symbol: 'A$' },
  { code: 'NZD', de: 'Neuseeland-Dollar', en: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'JPY', de: 'Japanischer Yen', en: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', de: 'Chinesischer Yuan', en: 'Chinese Yuan', symbol: '¥' },
  { code: 'HKD', de: 'Hongkong-Dollar', en: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'SGD', de: 'Singapur-Dollar', en: 'Singapore Dollar', symbol: 'S$' },
  { code: 'KRW', de: 'Südkoreanischer Won', en: 'South Korean Won', symbol: '₩' },
  { code: 'THB', de: 'Thailändischer Baht', en: 'Thai Baht', symbol: '฿' },
  { code: 'VND', de: 'Vietnamesischer Dong', en: 'Vietnamese Dong', symbol: '₫' },
  { code: 'IDR', de: 'Indonesische Rupiah', en: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'MYR', de: 'Malaysischer Ringgit', en: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'PHP', de: 'Philippinischer Peso', en: 'Philippine Peso', symbol: '₱' },
  { code: 'INR', de: 'Indische Rupie', en: 'Indian Rupee', symbol: '₹' },
  { code: 'PKR', de: 'Pakistanische Rupie', en: 'Pakistani Rupee', symbol: '₨' },
  { code: 'AED', de: 'VAE-Dirham', en: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SAR', de: 'Saudi-Riyal', en: 'Saudi Riyal', symbol: '﷼' },
  { code: 'ILS', de: 'Israelischer Schekel', en: 'Israeli Shekel', symbol: '₪' },
  { code: 'EGP', de: 'Ägyptisches Pfund', en: 'Egyptian Pound', symbol: 'E£' },
  { code: 'MAD', de: 'Marokkanischer Dirham', en: 'Moroccan Dirham', symbol: 'د.م.' },
  { code: 'TND', de: 'Tunesischer Dinar', en: 'Tunisian Dinar', symbol: 'د.ت' },
  { code: 'ZAR', de: 'Südafrikanischer Rand', en: 'South African Rand', symbol: 'R' },
  { code: 'KES', de: 'Kenia-Schilling', en: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'NGN', de: 'Nigerianischer Naira', en: 'Nigerian Naira', symbol: '₦' },
  { code: 'BRL', de: 'Brasilianischer Real', en: 'Brazilian Real', symbol: 'R$' },
  { code: 'MXN', de: 'Mexikanischer Peso', en: 'Mexican Peso', symbol: 'MX$' },
  { code: 'ARS', de: 'Argentinischer Peso', en: 'Argentine Peso', symbol: 'AR$' },
  { code: 'CLP', de: 'Chilenischer Peso', en: 'Chilean Peso', symbol: 'CL$' },
  { code: 'COP', de: 'Kolumbianischer Peso', en: 'Colombian Peso', symbol: 'CO$' },
  { code: 'PEN', de: 'Peruanischer Sol', en: 'Peruvian Sol', symbol: 'S/' },
  { code: 'UYU', de: 'Uruguayischer Peso', en: 'Uruguayan Peso', symbol: '$U' },
]

const NACH_CODE = new Map(WAEHRUNGEN.map((w) => [w.code, w]))

export function waehrung(code: string): Waehrung {
  return NACH_CODE.get(code.toUpperCase()) ?? { code, de: code, en: code, symbol: code }
}

/** The symbol shown on the currency button. Falls back to the code. */
export function symbolFuer(code: string): string {
  return waehrung(code).symbol
}

/** Matches against code, German name, English name and symbol. */
export function sucheWaehrungen(begriff: string): Waehrung[] {
  const q = begriff.trim().toLowerCase()
  if (!q) return WAEHRUNGEN

  return WAEHRUNGEN.filter(
    (w) =>
      w.code.toLowerCase().includes(q) ||
      w.de.toLowerCase().includes(q) ||
      w.en.toLowerCase().includes(q) ||
      w.symbol.toLowerCase().includes(q),
  )
}

/**
 * Lebanon's governorates (muhafazat), used by the Governorate dropdown at checkout and on the
 * account page. Edit this list if the delivery areas change; orders store the chosen name as text.
 */
export const LEBANON_GOVERNORATES = [
  'Beirut',
  'Mount Lebanon',
  'Keserwan-Jbeil',
  'North Lebanon',
  'Akkar',
  'Bekaa',
  'Baalbek-Hermel',
  'South Lebanon',
  'Nabatieh'
] as const;

/**
 * Matches a value typed before the dropdown existed (e.g. "north", "Jbeil", "Mount lebanon")
 * to a governorate name. Returns '' when nothing matches.
 */
export function matchGovernorate(value: string): string {
  const v = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  if (!v) return '';
  const exact = LEBANON_GOVERNORATES.find((g) => g.toLowerCase().replace(/-/g, ' ') === v);
  if (exact) return exact;
  const aliases: Array<[RegExp, string]> = [
    [/^beir?ut|^bayrut/, 'Beirut'],
    [/keserwan|kesrouan|jbeil|byblos/, 'Keserwan-Jbeil'],
    [/mount|jabal|matn|metn|baabda|aley|chouf|shouf/, 'Mount Lebanon'],
    [/akkar/, 'Akkar'],
    [/baalbek|hermel/, 'Baalbek-Hermel'],
    [/nabat/, 'Nabatieh'],
    [/bekaa|beqaa|zahle/, 'Bekaa'],
    [/north|tripoli|shamal/, 'North Lebanon'],
    [/south|saida|sidon|tyre|sour|janoub/, 'South Lebanon']
  ];
  return aliases.find(([re]) => re.test(v))?.[1] ?? '';
}

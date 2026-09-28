/**
 * Phone number fields with a country picker: every <input type="tel"> in the store and the admin
 * (checkout, account, track order, "Order on WhatsApp", admin contact phone…) gets a flag button.
 *
 * - The country starts as the visitor's own country (detected by Cloudflare, set by src/middleware.ts
 *   as window.__CT_COUNTRY__), or the one they picked last time; Lebanon when unknown.
 * - Typing is formatted the way numbers are written in that country ("71 123 456" in Lebanon) and
 *   checked: a number with too few or too many digits shows "Enter a valid … number".
 * - Pasting or autofilling "+44 7911 123456" or "0096171…" switches to the right country.
 * - Pages read the field as usual: input.value and form submissions give the full international
 *   number ("+961 71 123 456"), and setting input.value to any saved number shows it correctly.
 *   Add data-no-country to an input to leave it as a plain field.
 * Flags: public/phone-flags.webp (one image with every flag, from the MIT flag-icons project).
 */
(() => {
  if (window.__ctPhoneUi) return;
  window.__ctPhoneUi = true;

  // ---------- Countries ----------
  // code;name;dial code;rules. A rule is prefix>digits>pattern: an optional regex the number starts
  // with, how many digits the number has without the dial code (or a range), and how it is written
  // (# = digit). N = North American format. No rules: 6–12 digits in groups of three.
  const N = '(###) ###-####';
  const RAW = `AF;Afghanistan;93;>9>## ### ####
AL;Albania;355;>8-9>## ### ####
DZ;Algeria;213;>8-9>### ## ## ##
AD;Andorra;376;>6-9>### ###
AO;Angola;244;>9>### ### ###
AI;Anguilla;1;^264>10>N
AG;Antigua and Barbuda;1;^268>10>N
AR;Argentina;54;>10-11>## ####-####
AM;Armenia;374;>8>## ### ###
AW;Aruba;297;>7>### ####
AU;Australia;61;>9>### ### ###
AT;Austria;43;>4-13>
AZ;Azerbaijan;994;>9>## ### ## ##
BS;Bahamas;1;^242>10>N
BH;Bahrain;973;>8>#### ####
BD;Bangladesh;880;>8-10>#### ######
BB;Barbados;1;^246>10>N
BY;Belarus;375;>9>## ###-##-##
BE;Belgium;32;>8-9>### ## ## ##
BZ;Belize;501;>7>###-####
BJ;Benin;229;>8-10>## ## ## ##
BM;Bermuda;1;^441>10>N
BT;Bhutan;975;>7-8>
BO;Bolivia;591;>8>########
BA;Bosnia and Herzegovina;387;>8-9>## ### ###
BW;Botswana;267;>7-8>## ### ###
BR;Brazil;55;>10-11>## #####-####
VG;British Virgin Islands;1;^284>10>N
BN;Brunei;673;>7>### ####
BG;Bulgaria;359;>8-9>### ### ###
BF;Burkina Faso;226;>8>## ## ## ##
BI;Burundi;257;>8>## ## ## ##
KH;Cambodia;855;>8-9>## ### ####
CM;Cameroon;237;>9># ## ## ## ##
CA;Canada;1;^(204|226|236|249|250|263|289|306|343|354|365|367|368|382|387|403|416|418|428|431|437|438|450|468|474|506|514|519|548|579|581|584|587|604|613|639|647|672|683|705|709|742|753|778|780|782|807|819|825|867|873|879|902|905)>10>N
CV;Cape Verde;238;>7>### ## ##
KY;Cayman Islands;1;^345>10>N
CF;Central African Republic;236;>8>## ## ## ##
TD;Chad;235;>8>## ## ## ##
CL;Chile;56;>9># #### ####
CN;China;86;>10-11>### #### ####
CO;Colombia;57;>10>### ### ####
KM;Comoros;269;>7>### ## ##
CG;Congo;242;>9>## ### ####
CD;Congo (DRC);243;>9>### ### ###
CK;Cook Islands;682;>5>## ###
CR;Costa Rica;506;>8>#### ####
CI;Côte d’Ivoire;225;>10>## ## ## ## ##
HR;Croatia;385;>8-9>## ### ####
CU;Cuba;53;>8># ### ####
CW;Curaçao;599;>7-8>### ####
CY;Cyprus;357;>8>## ######
CZ;Czechia;420;>9>### ### ###
DK;Denmark;45;>8>## ## ## ##
DJ;Djibouti;253;>8>## ## ## ##
DM;Dominica;1;^767>10>N
DO;Dominican Republic;1;^(809|829|849)>10>N
EC;Ecuador;593;>8-9>## ### ####
EG;Egypt;20;>9-10>### ### ####
SV;El Salvador;503;>8>#### ####
GQ;Equatorial Guinea;240;>9>### ### ###
ER;Eritrea;291;>7># ### ###
EE;Estonia;372;>7-8>#### ####
SZ;Eswatini;268;>8>#### ####
ET;Ethiopia;251;>9>## ### ####
FK;Falkland Islands;500;>5>#####
FO;Faroe Islands;298;>6>######
FJ;Fiji;679;>7>### ####
FI;Finland;358;>5-12>
FR;France;33;>9># ## ## ## ##
GF;French Guiana;594;>9>### ## ## ##
PF;French Polynesia;689;>8>## ## ## ##
GA;Gabon;241;>7-8>## ## ## ##
GM;Gambia;220;>7>### ####
GE;Georgia;995;>9>### ## ## ##
DE;Germany;49;>6-11>
GH;Ghana;233;>9>## ### ####
GI;Gibraltar;350;>8>### #####
GR;Greece;30;>10>### ### ####
GL;Greenland;299;>6>## ## ##
GD;Grenada;1;^473>10>N
GP;Guadeloupe;590;>9>### ## ## ##
GU;Guam;1;^671>10>N
GT;Guatemala;502;>8>#### ####
GN;Guinea;224;>9>### ## ## ##
GW;Guinea-Bissau;245;>9>### ######
GY;Guyana;592;>7>### ####
HT;Haiti;509;>8>## ## ####
HN;Honduras;504;>8>####-####
HK;Hong Kong;852;>8>#### ####
HU;Hungary;36;>8-9>## ### ####
IS;Iceland;354;>7>### ####
IN;India;91;>10>##### #####
ID;Indonesia;62;>9-12>###-####-####
IR;Iran;98;>10>### ### ####
IQ;Iraq;964;>8-10>### ### ####
IE;Ireland;353;>7-9>## ### ####
IL;Israel;972;>8-9>##-###-####
IT;Italy;39;>6-11>### ### ####
JM;Jamaica;1;^(876|658)>10>N
JP;Japan;81;>9-10>## #### ####
JO;Jordan;962;>8-9># #### ####
KZ;Kazakhstan;7;^[67]>10>### ### ## ##
KE;Kenya;254;>9>### ######
KI;Kiribati;686;>5-8>
XK;Kosovo;383;>8-9>## ### ###
KW;Kuwait;965;>8>#### ####
KG;Kyrgyzstan;996;>9>### ### ###
LA;Laos;856;>8-10>## ## ### ###
LV;Latvia;371;>8>## ### ###
LB;Lebanon;961;^(7[016789]|81)>8>## ### ###,>7># ### ###
LS;Lesotho;266;>8>#### ####
LR;Liberia;231;>7-9>## ### ####
LY;Libya;218;>9>##-#######
LI;Liechtenstein;423;>7>### ## ##
LT;Lithuania;370;>8>### #####
LU;Luxembourg;352;>6-11>
MO;Macao;853;>8>#### ####
MG;Madagascar;261;>9>## ## ### ##
MW;Malawi;265;>7-9>### ## ## ##
MY;Malaysia;60;>9-10>##-### ####
MV;Maldives;960;>7>###-####
ML;Mali;223;>8>## ## ## ##
MT;Malta;356;>8>#### ####
MH;Marshall Islands;692;>7>###-####
MQ;Martinique;596;>9>### ## ## ##
MR;Mauritania;222;>8>## ## ## ##
MU;Mauritius;230;>7-8>#### ####
YT;Mayotte;262;^(269|639)>9>### ## ## ##
MX;Mexico;52;>10>## #### ####
FM;Micronesia;691;>7>### ####
MD;Moldova;373;>8>### ## ###
MC;Monaco;377;>8-9>## ## ## ##
MN;Mongolia;976;>8>#### ####
ME;Montenegro;382;>8>## ### ###
MS;Montserrat;1;^664>10>N
MA;Morocco;212;>9>###-######
MZ;Mozambique;258;>8-9>## ### ####
MM;Myanmar;95;>7-10>
NA;Namibia;264;>8-9>## ### ####
NR;Nauru;674;>7>### ####
NP;Nepal;977;>8-10>###-#######
NL;Netherlands;31;>9># ########
NC;New Caledonia;687;>6>##.##.##
NZ;New Zealand;64;>8-10>## ### ####
NI;Nicaragua;505;>8>#### ####
NE;Niger;227;>8>## ## ## ##
NG;Nigeria;234;>8-10>### ### ####
NU;Niue;683;>4-7>
KP;North Korea;850;>8-10>
MK;North Macedonia;389;>8>## ### ###
MP;Northern Mariana Islands;1;^670>10>N
NO;Norway;47;>8>### ## ###
OM;Oman;968;>8>#### ####
PK;Pakistan;92;>9-10>### #######
PW;Palau;680;>7>### ####
PS;Palestine;970;>8-9>### ### ###
PA;Panama;507;>7-8>####-####
PG;Papua New Guinea;675;>7-8>### ####
PY;Paraguay;595;>9>### ######
PE;Peru;51;>8-9>### ### ###
PH;Philippines;63;>8-10>### ### ####
PL;Poland;48;>9>### ### ###
PT;Portugal;351;>9>### ### ###
PR;Puerto Rico;1;^(787|939)>10>N
QA;Qatar;974;>8>#### ####
RE;Réunion;262;>9>### ## ## ##
RO;Romania;40;>9>### ### ###
RU;Russia;7;>10>### ###-##-##
RW;Rwanda;250;>9>### ### ###
PM;Saint Pierre and Miquelon;508;>6>## ## ##
KN;Saint Kitts and Nevis;1;^869>10>N
LC;Saint Lucia;1;^758>10>N
VC;Saint Vincent and the Grenadines;1;^784>10>N
WS;Samoa;685;>5-7>
SM;San Marino;378;>6-10>
ST;São Tomé and Príncipe;239;>7>### ####
SA;Saudi Arabia;966;>8-9>## ### ####
SN;Senegal;221;>9>## ### ## ##
RS;Serbia;381;>8-9>## #######
SC;Seychelles;248;>7># ### ###
SL;Sierra Leone;232;>8>## ######
SG;Singapore;65;>8>#### ####
SX;Sint Maarten;1;^721>10>N
SK;Slovakia;421;>9>### ### ###
SI;Slovenia;386;>8>## ### ###
SB;Solomon Islands;677;>5-7>
SO;Somalia;252;>7-9>
ZA;South Africa;27;>9>## ### ####
KR;South Korea;82;>9-10>##-####-####
SS;South Sudan;211;>9>### ### ###
ES;Spain;34;>9>### ## ## ##
LK;Sri Lanka;94;>9>## ### ####
SD;Sudan;249;>9>## ### ####
SR;Suriname;597;>6-7>###-####
SE;Sweden;46;>7-9>##-### ## ##
CH;Switzerland;41;>9>## ### ## ##
SY;Syria;963;>8-9>### ### ###
TW;Taiwan;886;>8-9>### ### ###
TJ;Tajikistan;992;>9>### ## ####
TZ;Tanzania;255;>9>### ### ###
TH;Thailand;66;>8-9>## ### ####
TL;Timor-Leste;670;>7-8>
TG;Togo;228;>8>## ## ## ##
TO;Tonga;676;>5-7>
TT;Trinidad and Tobago;1;^868>10>N
TN;Tunisia;216;>8>## ### ###
TR;Türkiye;90;>10>### ### ## ##
TM;Turkmenistan;993;>8>## ######
TC;Turks and Caicos Islands;1;^649>10>N
TV;Tuvalu;688;>5-6>
VI;U.S. Virgin Islands;1;^340>10>N
UG;Uganda;256;>9>### ######
UA;Ukraine;380;>9>## ### ## ##
AE;United Arab Emirates;971;>8-9>## ### ####
GB;United Kingdom;44;>9-10>#### ######
US;United States;1;>10>N
UY;Uruguay;598;>8># ### ####
UZ;Uzbekistan;998;>9>## ### ## ##
VU;Vanuatu;678;>5-7>
VE;Venezuela;58;>10>###-#######
VN;Vietnam;84;>9-10>### ### ####
WF;Wallis and Futuna;681;>6>## ## ##
YE;Yemen;967;>7-9>### ### ###
ZM;Zambia;260;>9>## #######
ZW;Zimbabwe;263;>9>## ### ####`;

  const COUNTRIES = RAW.split('\n').map((line, index) => {
    const [iso, name, dial, rules] = line.split(';');
    return {
      iso, name, dial, index,
      rules: (rules || '>6-12>').split(',').map((rule) => {
        const [prefix, lengths, pattern] = rule.split('>');
        const [min, max = min] = lengths.split('-').map(Number);
        return { re: prefix ? new RegExp(prefix) : null, min, max, pattern: pattern === 'N' ? N : pattern || '' };
      })
    };
  });
  const BY_ISO = new Map(COUNTRIES.map((c) => [c.iso, c]));
  const HOME = BY_ISO.get('LB');
  // Countries where the leading 0 is part of the number (elsewhere a typed 0 is the local trunk prefix).
  const KEEP_ZERO = new Set(['IT', 'SM', 'CI']);
  const SAVED_KEY = 'ct-phone-country';
  const SPRITE_COLS = 16;

  const readSaved = () => { try { return localStorage.getItem(SAVED_KEY) || ''; } catch { return ''; } };
  const detected = () => BY_ISO.get(String(window.__CT_COUNTRY__ || '').toUpperCase());
  const startCountry = () => BY_ISO.get(readSaved()) || detected() || HOME;

  const ruleFor = (country, digits) => country.rules.find((r) => !r.re || r.re.test(digits)) || country.rules[country.rules.length - 1];

  /** Digits written in the country's pattern; digits past the pattern are added at the end. */
  function formatDigits(country, digits) {
    if (!digits) return '';
    const { pattern } = ruleFor(country, digits);
    if (!pattern) {
      const groups = [];
      let rest = digits;
      while (rest.length > 4) { groups.push(rest.slice(0, 3)); rest = rest.slice(3); }
      return [...groups, rest].join(' ');
    }
    let out = '';
    let i = 0;
    for (const ch of pattern) {
      if (i >= digits.length) break;
      out += ch === '#' ? digits[i++] : ch;
    }
    return out + digits.slice(i);
  }

  /**
   * Digits cut to the most a number in that country can have (Lebanon: 8 for 70/71/76/78/79/81…,
   * 7 for 03, 01…). A typed local 0 is extra; a repeated dial code ("961 71…") is dropped first.
   */
  function limit(country, digits) {
    const zero = !KEEP_ZERO.has(country.iso) && digits.startsWith('0') ? '0' : '';
    let sig = digits.slice(zero.length);
    if (sig.length > ruleFor(country, sig).max && sig.startsWith(country.dial)) sig = sig.slice(country.dial.length);
    return zero + sig.slice(0, ruleFor(country, sig).max);
  }

  const significant = (country, digits) => (KEEP_ZERO.has(country.iso) ? digits : digits.replace(/^0/, ''));
  /** What the visitor sees: the number in local format (a typed leading 0 stays until they leave the field). */
  const display = (country, digits) => {
    const sig = significant(country, digits);
    return (sig.length < digits.length ? '0' : '') + formatDigits(country, sig);
  };
  const fullNumber = (state) => {
    const sig = significant(state.country, state.digits);
    return sig ? `+${state.country.dial} ${formatDigits(state.country, sig)}` : '';
  };
  const example = (country) => {
    if (country.iso === 'LB') return '71 123 456';
    const rule = country.rules[0];
    const sample = rule.pattern === N ? '2015550123' : '7123456789012'.slice(0, rule.max);
    return formatDigits(country, sample);
  };

  /** Country and digits from an international number ("+961 71…", "00961…"), or null. */
  function parseInternational(text, current) {
    const digits = text.replace(/^\s*(\+|00)/, '').replace(/\D/g, '');
    for (let len = 4; len >= 1; len--) {
      const dial = digits.slice(0, len);
      const matches = COUNTRIES.filter((c) => c.dial === dial);
      if (!matches.length) continue;
      const rest = digits.slice(len);
      // Shared codes (+1, +7, +262…): the territory whose area code matches, else the one already
      // chosen, else the main country (United States, Russia…).
      const country = matches.find((c) => c.rules.length === 1 && c.rules[0].re && rest.length >= 3 && c.rules[0].re.test(rest))
        || (current && matches.includes(current) ? current : null)
        || matches.find((c) => !c.rules[0].re || c.rules.length > 1)
        || matches[0];
      return { country, digits: rest };
    }
    return null;
  }

  // ---------- Styles (injected once so the store and the admin share them) ----------
  const css = `
.phone-field{position:relative;display:block;width:100%;grid-column:1/-1;flex:1 1 100%;min-width:0;font-weight:500}
.phone-field>input.pf-input{width:100%;padding-left:108px}
label span.phone-field{color:var(--ink,#222);font-weight:500}
span.phone-field span:not(.pf-dial){color:inherit}
.pf-cc{position:absolute;left:4px;top:4px;bottom:4px;display:inline-flex;align-items:center;gap:6px;padding:0 8px 0 10px;border:0;border-right:1.5px solid var(--line-strong,#ddd);border-radius:var(--radius-xs,8px) 0 0 var(--radius-xs,8px);background:transparent;color:inherit;font:inherit;font-size:.95rem;font-weight:600;cursor:pointer;z-index:1}
.pf-cc:hover{background:color-mix(in srgb,currentColor 6%,transparent)}
.pf-cc:focus-visible{outline:2px solid currentColor;outline-offset:-2px}
.pf-cc svg{width:10px;height:10px;opacity:.6;transition:transform .2s}
.pf-cc[aria-expanded=true] svg{transform:rotate(180deg)}
.pf-flag{flex:0 0 auto;width:20px;height:15px;border-radius:3px;background:#e9e6e1 url(/phone-flags.webp?v=1) no-repeat;background-size:${SPRITE_COLS * 20}px auto;box-shadow:0 0 0 1px rgba(0,0,0,.08)}
.pf-panel{position:absolute;left:0;top:calc(100% + 6px);z-index:60;width:max(100%,280px);max-width:min(400px,calc(100vw - 32px));padding:8px;border:1.5px solid var(--line,#e5e5e5);border-radius:var(--radius-sm,12px);background:var(--surface,#fff);color:var(--ink,#222);box-shadow:0 18px 40px rgba(20,16,30,.18);font-weight:500;text-align:left;animation:pf-in .16s ease-out}
.pf-panel[hidden]{display:none}
@keyframes pf-in{from{opacity:0;transform:translateY(-4px)}}
@media (prefers-reduced-motion:reduce){.pf-panel{animation:none}.pf-cc svg{transition:none}}
.phone-field .pf-panel input.pf-search{display:block;width:100%;min-height:40px;height:40px;margin:0 0 6px;padding:8px 12px;border:1.5px solid var(--line-strong,#ddd);border-radius:var(--radius-xs,8px);background:var(--surface,#fff);color:inherit;font-size:16px;font-weight:500;box-shadow:none;outline:none}
.phone-field .pf-panel input.pf-search:focus{border-color:var(--ink,#222)}
.pf-list{max-height:260px;margin:0;padding:0;overflow:auto;list-style:none;overscroll-behavior:contain}
.pf-list li{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:var(--radius-xs,8px);cursor:pointer;font-size:.92rem;line-height:1.2}
.phone-field .pf-list li span{font-weight:inherit}
.pf-list li[aria-selected=true]{font-weight:700}
.pf-list li.pf-active{background:color-mix(in srgb,currentColor 8%,transparent)}
.pf-list .pf-name{flex:1;min-width:0}
.pf-list .pf-dial{color:var(--muted,#777);font-variant-numeric:tabular-nums}
.pf-list .pf-sep{height:1px;margin:4px 6px;padding:0;background:var(--line,#e5e5e5);pointer-events:none}
.pf-empty{margin:0;padding:10px;color:var(--muted,#777);font-size:.9rem}
`;
  const style = document.createElement('style');
  style.id = 'phone-ui-css';
  style.textContent = css;
  document.head.appendChild(style);

  const flagStyle = (country) => `background-position:-${(country.index % SPRITE_COLS) * 20}px -${Math.floor(country.index / SPRITE_COLS) * 15}px`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const plain = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

  const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  let uid = 0;

  // ---------- One phone field ----------
  function enhance(input) {
    if (input.dataset.pf || input.hasAttribute('data-no-country')) return;
    input.dataset.pf = '1';
    const state = { country: startCountry(), digits: '' };

    const wrap = document.createElement('span');
    wrap.className = 'phone-field';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    input.classList.add('pf-input');
    input.setAttribute('inputmode', 'tel');
    if (!input.id) input.id = `pf-input-${++uid}`;
    // The label wraps the flag button too; point it at the text box so clicking the label focuses it.
    const label = input.closest('label');
    if (label && !label.htmlFor) label.htmlFor = input.id;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pf-cc';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    wrap.insertBefore(button, input);

    const panel = document.createElement('div');
    panel.className = 'pf-panel';
    panel.hidden = true;
    panel.innerHTML = '<input class="pf-search" type="search" autocomplete="off" placeholder="Search country or code" aria-label="Search country or dial code"><ul class="pf-list" role="listbox" aria-label="Country"></ul>';
    wrap.appendChild(panel);
    const search = panel.querySelector('.pf-search');
    const list = panel.querySelector('.pf-list');

    const setShown = (text) => proto.set.call(input, text);
    const shown = () => proto.get.call(input);

    const validate = () => {
      const sig = significant(state.country, state.digits);
      const rule = ruleFor(state.country, sig);
      const ok = !sig || (sig.length >= rule.min && sig.length <= rule.max);
      input.setCustomValidity(ok ? '' : `Enter a valid ${state.country.name} phone number, e.g. ${example(state.country)}`);
    };
    const renderButton = () => {
      button.innerHTML = `<span class="pf-flag" style="${flagStyle(state.country)}"></span><span>+${state.country.dial}</span><svg viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m1 1 4 4 4-4"/></svg>`;
      button.dataset.country = state.country.iso;
      button.setAttribute('aria-label', `Country: ${state.country.name} +${state.country.dial}. Change country`);
      input.placeholder = example(state.country);
      fitPadding();
    };
    // Leave room for the flag button inside the text box. Measured again whenever the button changes
    // size, so fields on tabs that start hidden (e.g. Admin → Storefront → Footer) show the number too.
    const fitPadding = () => { if (button.offsetWidth) input.style.paddingLeft = `${button.offsetWidth + 14}px`; };
    if ('ResizeObserver' in window) new ResizeObserver(fitPadding).observe(button);
    const render = () => { setShown(display(state.country, state.digits)); validate(); };

    /** Reads any saved or typed number: international ones pick their country. */
    const load = (text, fromCode) => {
      const value = String(text ?? '').trim();
      const intl = /^(\+|00)/.test(value) ? parseInternational(value, state.country) : null;
      if (intl) state.country = intl.country;
      else if (fromCode && value) {
        // Numbers saved before the country picker existed were Lebanese ("71 123 456", "03 …").
        const d = value.replace(/\D/g, '').replace(/^0/, '');
        const lb = ruleFor(HOME, d);
        if (state.country !== HOME && d.length >= lb.min && d.length <= lb.max) state.country = HOME;
      }
      state.digits = intl ? intl.digits : value.replace(/\D/g, '');
      // Typed or pasted numbers never go past the country's length (saved ones are shown as they are).
      if (!fromCode) state.digits = limit(state.country, state.digits);
      renderButton();
    };
    /** Leaving the field: drop a typed local 0 or a repeated dial code ("961 71…"). */
    const tidy = () => {
      let d = significant(state.country, state.digits);
      const rule = ruleFor(state.country, d);
      if (d.startsWith(state.country.dial) && d.length > rule.max) d = significant(state.country, d.slice(state.country.dial.length));
      state.digits = d;
      render();
    };

    // Pages keep using input.value: it reads as the full international number and accepts any number.
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: () => fullNumber(state),
      set: (text) => { load(text, true); tidy(); }
    });

    input.addEventListener('beforeinput', (event) => {
      // Backspace right after a space or dash removes the digit before it (otherwise nothing would change).
      if (event.inputType !== 'deleteContentBackward') return;
      const at = input.selectionStart;
      const text = shown();
      if (at == null || at !== input.selectionEnd || at === 0 || /\d/.test(text[at - 1])) return;
      let j = at - 1;
      while (j >= 0 && !/\d/.test(text[j])) j--;
      if (j < 0) return;
      event.preventDefault();
      setShown(text.slice(0, j) + text.slice(at));
      input.setSelectionRange(j, j);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Listening on the wrapper (capture) formats the number before the page's own listeners read it.
    wrap.addEventListener('input', (event) => {
      if (event.target !== input) return;
      const text = shown();
      const caret = input.selectionStart ?? text.length;
      const digitsBefore = text.slice(0, caret).replace(/\D/g, '').length;
      if (/^\s*(\+|00)/.test(text)) {
        // Pasted or autofilled with a country code: switch country.
        const before = state.country;
        load(text, false);
        if (state.country !== before) rememberCountry(state.country);
        render();
        input.setSelectionRange(shown().length, shown().length);
        return;
      }
      const typed = text.replace(/\D/g, '');
      const fitted = limit(state.country, typed);
      if (fitted.length < typed.length && typed.startsWith(fitted) && event.inputType === 'insertText') {
        // The number is already full: ignore the extra key and keep the caret where it was.
        const back = Math.max(0, caret - (text.length - display(state.country, state.digits).length));
        render();
        input.setSelectionRange(back, back);
        return;
      }
      state.digits = fitted;
      render();
      // Put the caret back after the same digit.
      const out = shown();
      let pos = 0;
      for (let seen = 0; pos < out.length && seen < digitsBefore; pos++) if (/\d/.test(out[pos])) seen++;
      if (document.activeElement === input) input.setSelectionRange(pos, pos);
    }, true);
    input.addEventListener('blur', tidy);

    // Submitted forms carry the full number (new FormData(form) and normal submits).
    const form = input.form;
    if (form && !form.dataset.pfBound) {
      form.dataset.pfBound = '1';
      form.addEventListener('formdata', (event) => {
        form.querySelectorAll('input.pf-input[name]').forEach((field) => event.formData.set(field.name, field.value));
      });
    }
    form?.addEventListener('reset', () => setTimeout(() => { state.digits = ''; render(); }));

    // ---------- Country list ----------
    let active = -1;
    let items = [];
    const rememberCountry = (country) => { try { localStorage.setItem(SAVED_KEY, country.iso); } catch {} };
    const fill = () => {
      const q = plain(search.value.trim()).replace(/^\+/, '');
      const top = [...new Set([detected(), HOME].filter(Boolean))];
      const match = (c) => !q || plain(c.name).includes(q) || c.dial.startsWith(q.replace(/\D/g, '') || '-') || c.iso.toLowerCase() === q;
      const rows = q ? COUNTRIES.filter(match).sort((a, b) => Number(!plain(b.name).startsWith(q)) - Number(!plain(a.name).startsWith(q))) : [...top, null, ...COUNTRIES.filter((c) => !top.includes(c))];
      list.innerHTML = rows.length ? rows.map((c) => c ? `<li role="option" id="${input.id}-${c.iso}" data-iso="${c.iso}" aria-selected="${c === state.country}"><span class="pf-flag" style="${flagStyle(c)}"></span><span class="pf-name">${esc(c.name)}</span><span class="pf-dial">+${c.dial}</span></li>` : '<li class="pf-sep" role="presentation"></li>').join('') : '<li class="pf-empty" role="presentation">No country found</li>';
      items = [...list.querySelectorAll('[role=option]')];
      setActive(q ? 0 : items.findIndex((li) => li.dataset.iso === state.country.iso), !q);
    };
    const setActive = (i, center) => {
      items[active]?.classList.remove('pf-active');
      active = Math.max(-1, Math.min(items.length - 1, i));
      const li = items[active];
      if (!li) { search.removeAttribute('aria-activedescendant'); return; }
      li.classList.add('pf-active');
      search.setAttribute('aria-activedescendant', li.id);
      if (center) list.scrollTop = li.offsetTop - list.clientHeight / 2 + li.offsetHeight / 2;
      else li.scrollIntoView({ block: 'nearest' });
    };
    const open = () => {
      panel.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      search.value = '';
      fill();
      // On phones, don't pop the keyboard over the list: focus the search only with a mouse/keyboard.
      if (matchMedia('(hover:hover) and (pointer:fine)').matches) search.focus({ preventScroll: true });
      document.addEventListener('pointerdown', outside, true);
    };
    const close = (focusInput) => {
      if (panel.hidden) return;
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', outside, true);
      if (focusInput) input.focus();
    };
    const outside = (event) => { if (!wrap.contains(event.target)) close(false); };
    const choose = (iso) => {
      const country = BY_ISO.get(iso);
      if (!country) return;
      state.country = country;
      rememberCountry(country);
      renderButton();
      render();
      close(true);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    button.addEventListener('click', () => (panel.hidden ? open() : close(true)));
    search.addEventListener('input', fill);
    search.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(active + (event.key === 'ArrowDown' ? 1 : -1)); }
      else if (event.key === 'Enter') { event.preventDefault(); if (items[active]) choose(items[active].dataset.iso); }
      else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
      else if (event.key === 'Tab') close(false);
    });
    list.addEventListener('click', (event) => { const li = event.target.closest('[role=option]'); if (li) choose(li.dataset.iso); });
    // Escape inside an "Order on WhatsApp" dialog closes only the list, not the whole dialog.
    wrap.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); event.stopPropagation(); close(true); } });

    load(shown(), true);
    render();
  }

  // ---------- Every phone field, including ones added later (dialogs, admin screens) ----------
  const scan = (root) => {
    if (root.matches?.('input[type=tel]')) enhance(root);
    root.querySelectorAll?.('input[type=tel]').forEach(enhance);
  };
  const start = () => {
    scan(document);
    new MutationObserver((records) => {
      for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) scan(node);
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

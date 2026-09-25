/**
 * Storefront design settings (Admin → Storefront), saved in store_settings.design (see
 * supabase/storefront_design.sql).
 *
 * Everything here has a safe default, so the store looks complete before anything is changed,
 * and every value from the database is cleaned before it reaches a page (text is trimmed and
 * length-limited, links must be site paths or https URLs, images must live in our storage).
 * Colours, logo and icon stay in Admin → Branding; contact details stay in Admin → SEO.
 */

export type FontPreset = 'premium' | 'modern' | 'playful' | 'classic';
export type Corners = 'sharp' | 'soft' | 'round';
export type Background = 'cream' | 'white' | 'tint';
export type ButtonStyle = 'pill' | 'rounded';
export type HomeSectionId = 'banners' | 'hero' | 'trust' | 'categories' | 'featured' | 'promo' | 'new' | 'ages' | 'story' | 'help';
/** A menu link: site path (/…) or https link. */
export type MenuLink = { label: string; href: string };

export type StoreDesign = {
  font: FontPreset;
  corners: Corners;
  background: Background;
  buttons: ButtonStyle;
  floating_cart: boolean;
  floating_whatsapp: boolean;
  hero: { eyebrow: string; title: string; highlight: string; text: string; primary_label: string; primary_link: string; secondary_label: string; secondary_link: string; image: string };
  trust: Array<{ icon: string; title: string; text: string }>;
  sections: Array<{ id: HomeSectionId; enabled: boolean }>;
  titles: Record<'categories' | 'featured' | 'new' | 'ages', { title: string; subtitle: string }>;
  promo: { eyebrow: string; title: string; text: string; button_label: string; button_link: string; image: string; style: 'brand' | 'accent' | 'dark' };
  story: { eyebrow: string; title: string; text: string; button_label: string; button_link: string; image: string };
  help: { title: string; text: string; button_label: string };
  product: { delivery: string; payment: string; returns: string };
  footer: { about: string; address: string; hours: string; note: string };
  /** Editable menus (Admin → Storefront & menus → Menus). */
  menus: { header: MenuLink[]; help: MenuLink[]; company: MenuLink[] };
};

/** Font pairs. `href` is the Google Fonts stylesheet; families are used by CSS through html[data-font]. */
export const FONT_PRESETS: Record<FontPreset, { label: string; description: string; href: string }> = {
  premium: { label: 'Boutique', description: 'Soft serif headlines with a clean modern body', href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap' },
  modern: { label: 'Modern', description: 'Crisp geometric sans-serif everywhere', href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap' },
  playful: { label: 'Playful', description: 'Rounded, friendly letters for a younger feel', href: 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800;900&display=swap' },
  classic: { label: 'Classic', description: 'Elegant high-contrast serif with a neat body font', href: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap' }
};

export const HOME_SECTIONS: Record<HomeSectionId, { label: string; description: string }> = {
  banners: { label: 'Banner slideshow', description: 'Your scheduled banners from Admin → Home banners (hidden when none are live)' },
  hero: { label: 'Hero banner', description: 'Big headline, buttons and image at the top' },
  trust: { label: 'Store promises', description: 'Short reasons to buy (delivery, payment…)' },
  categories: { label: 'Shop by category', description: 'Your categories as tiles' },
  featured: { label: 'Featured toys', description: 'Products marked "Featured"' },
  promo: { label: 'Promotion banner', description: 'A highlighted offer or collection' },
  new: { label: 'New arrivals', description: 'The newest toys in the store' },
  ages: { label: 'Shop by age', description: 'Age-range shortcuts' },
  story: { label: 'Our story', description: 'A short text about the store' },
  help: { label: 'Help choosing', description: 'WhatsApp call to action' }
};

export const DEFAULT_DESIGN: StoreDesign = {
  font: 'premium',
  corners: 'soft',
  background: 'cream',
  buttons: 'pill',
  floating_cart: false,
  floating_whatsapp: true,
  hero: {
    eyebrow: 'Clever Toys · Lebanon',
    title: 'Toys that make',
    highlight: 'childhood brighter',
    text: 'Thoughtfully chosen toys that spark imagination, learning and giggles, delivered to your door with cash on delivery.',
    primary_label: 'Shop all toys',
    primary_link: '/products',
    secondary_label: 'Browse categories',
    secondary_link: '/categories',
    image: ''
  },
  trust: [
    { icon: '🚚', title: 'Delivery across Lebanon', text: 'Track your order online' },
    { icon: '💵', title: 'Cash on delivery', text: 'Pay when your toys arrive' },
    { icon: '⭐', title: 'Hand-picked quality', text: 'Safe, durable and fun' },
    { icon: '💬', title: 'Real help on WhatsApp', text: 'Ask us anything about a toy' }
  ],
  sections: (['banners', 'hero', 'trust', 'categories', 'featured', 'promo', 'new', 'ages', 'story', 'help'] as HomeSectionId[]).map((id) => ({ id, enabled: true })),
  titles: {
    categories: { title: 'Shop by category', subtitle: 'Find the right kind of play for every child.' },
    featured: { title: 'Featured toys', subtitle: 'Our favourites, loved by kids and parents.' },
    new: { title: 'New arrivals', subtitle: 'Fresh finds, just landed in the store.' },
    ages: { title: 'Shop by age', subtitle: 'Toys matched to every stage of growing up.' }
  },
  promo: {
    eyebrow: 'This season',
    title: 'Gifts they will remember',
    text: 'Birthdays, holidays or just because: discover toys that bring the whole family together.',
    button_label: 'Find a gift',
    button_link: '/products',
    image: '',
    style: 'brand'
  },
  story: {
    eyebrow: 'Our story',
    title: 'Play is how children learn',
    text: 'Clever Toys started with a simple idea: every toy should be fun, safe and help children grow. We choose each product carefully and deliver it across Lebanon with a personal touch.',
    button_label: 'About us',
    button_link: '/about',
    image: ''
  },
  help: { title: 'Not sure what to choose?', text: 'Tell us the age and interests, and we will suggest the perfect toy on WhatsApp.', button_label: 'Ask on WhatsApp' },
  product: {
    delivery: 'Delivery across Lebanon, confirmed with you by phone',
    payment: 'Cash on delivery, no card needed',
    returns: 'Exchanges within 3 days of delivery (see Shipping & returns)'
  },
  footer: {
    about: 'Fun, educational and exciting toys for every stage of childhood, with cash on delivery across Lebanon.',
    address: '',
    hours: '',
    note: 'Made for curious minds 🧸'
  },
  menus: {
    header: [{ label: 'Categories', href: '/categories' }, { label: 'About', href: '/about' }, { label: 'Contact', href: '/contact' }, { label: 'Track order', href: '/track-order' }],
    help: [{ label: 'Track your order', href: '/track-order' }, { label: 'Shipping & returns', href: '/shipping-returns' }, { label: 'Contact us', href: '/contact' }, { label: 'My account', href: '/account' }],
    company: [{ label: 'About us', href: '/about' }, { label: 'Privacy policy', href: '/privacy' }, { label: 'Terms of sale', href: '/terms' }]
  }
};

// ---------- Cleaning helpers ----------
const text = (value: unknown, fallback: string, max: number) => {
  if (typeof value !== 'string') return fallback;
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
};
/** Multi-line text (keeps line breaks). */
const paragraph = (value: unknown, fallback: string, max: number) => typeof value === 'string' ? value.replace(/\r/g, '').trim().slice(0, max) : fallback;
const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T => options.includes(value as T) ? (value as T) : fallback;
const bool = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;
/** A saved menu: up to `max` links with a label and a safe link; the default when never saved. */
const menu = (value: unknown, fallback: MenuLink[], max: number): MenuLink[] => {
  if (!Array.isArray(value)) return fallback;
  return value.slice(0, max)
    .map((item: any) => ({ label: text(item?.label, '', 40), href: safeLink(item?.href, '') }))
    .filter((item) => item.label && item.href);
};
/** Site paths (/products?…) or https links only, never javascript: or data: links. */
export const safeLink = (value: unknown, fallback: string) => {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) return fallback;
  if (/^\/(?!\/)[^\s"<>]*$/.test(v) || /^https:\/\/[^\s"<>]+$/i.test(v)) return v.slice(0, 500);
  return fallback;
};
/** Images must be https URLs without characters that could break out of an attribute. */
const safeImage = (value: unknown) => {
  const v = typeof value === 'string' ? value.trim() : '';
  return /^https:\/\/[^\s"'<>]+$/i.test(v) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/[^\s"'<>]+$/i.test(v) ? v.slice(0, 1000) : '';
};

/** Turns whatever is stored in store_settings.design into a complete, safe StoreDesign. */
export function parseDesign(value: unknown): StoreDesign {
  const d = (value && typeof value === 'object' ? value : {}) as Record<string, any>;
  const D = DEFAULT_DESIGN;
  const hero = d.hero || {}, promo = d.promo || {}, story = d.story || {}, help = d.help || {}, product = d.product || {}, footer = d.footer || {}, titles = d.titles || {};

  // Sections: keep the saved order, drop unknown ids, and append any section added in a later version.
  const known = Object.keys(HOME_SECTIONS) as HomeSectionId[];
  const saved = Array.isArray(d.sections) ? d.sections.filter((s: any) => known.includes(s?.id)) : [];
  const seen = new Set<string>();
  // The banner slideshow (added later) goes to the top for designs saved before it existed.
  if (saved.length && !saved.some((s: any) => s.id === 'banners')) saved.unshift({ id: 'banners', enabled: true });
  const sections = [...saved, ...D.sections]
    .filter((s: any) => !seen.has(s.id) && seen.add(s.id))
    .map((s: any) => ({ id: s.id as HomeSectionId, enabled: bool(s.enabled, true) }));

  const trust = Array.isArray(d.trust)
    ? d.trust.slice(0, 4).map((t: any) => ({ icon: text(t?.icon, '', 8), title: text(t?.title, '', 60), text: text(t?.text, '', 90) })).filter((t: any) => t.title)
    : D.trust;

  const title = (key: keyof StoreDesign['titles']) => ({
    title: text(titles[key]?.title, D.titles[key].title, 80),
    subtitle: text(titles[key]?.subtitle, D.titles[key].subtitle, 160)
  });

  return {
    font: oneOf(d.font, ['premium', 'modern', 'playful', 'classic'] as const, D.font),
    corners: oneOf(d.corners, ['sharp', 'soft', 'round'] as const, D.corners),
    background: oneOf(d.background, ['cream', 'white', 'tint'] as const, D.background),
    buttons: oneOf(d.buttons, ['pill', 'rounded'] as const, D.buttons),
    floating_cart: bool(d.floating_cart, D.floating_cart),
    floating_whatsapp: bool(d.floating_whatsapp, D.floating_whatsapp),
    hero: {
      eyebrow: text(hero.eyebrow, D.hero.eyebrow, 60),
      title: text(hero.title, D.hero.title, 80),
      highlight: text(hero.highlight, D.hero.highlight, 60),
      text: text(hero.text, D.hero.text, 260),
      primary_label: text(hero.primary_label, D.hero.primary_label, 40),
      primary_link: safeLink(hero.primary_link, D.hero.primary_link),
      secondary_label: text(hero.secondary_label, D.hero.secondary_label, 40),
      secondary_link: safeLink(hero.secondary_link, D.hero.secondary_link),
      image: safeImage(hero.image)
    },
    trust,
    sections,
    titles: { categories: title('categories'), featured: title('featured'), new: title('new'), ages: title('ages') },
    promo: {
      eyebrow: text(promo.eyebrow, D.promo.eyebrow, 60),
      title: text(promo.title, D.promo.title, 90),
      text: text(promo.text, D.promo.text, 260),
      button_label: text(promo.button_label, D.promo.button_label, 40),
      button_link: safeLink(promo.button_link, D.promo.button_link),
      image: safeImage(promo.image),
      style: oneOf(promo.style, ['brand', 'accent', 'dark'] as const, D.promo.style)
    },
    story: {
      eyebrow: text(story.eyebrow, D.story.eyebrow, 60),
      title: text(story.title, D.story.title, 90),
      text: paragraph(story.text, D.story.text, 900),
      button_label: text(story.button_label, D.story.button_label, 40),
      button_link: safeLink(story.button_link, D.story.button_link),
      image: safeImage(story.image)
    },
    help: {
      title: text(help.title, D.help.title, 80),
      text: text(help.text, D.help.text, 200),
      button_label: text(help.button_label, D.help.button_label, 40)
    },
    product: {
      delivery: text(product.delivery, D.product.delivery, 120),
      payment: text(product.payment, D.product.payment, 120),
      returns: text(product.returns, D.product.returns, 120)
    },
    footer: {
      about: text(footer.about, D.footer.about, 260),
      address: text(footer.address, D.footer.address, 160),
      hours: text(footer.hours, D.footer.hours, 120),
      note: text(footer.note, D.footer.note, 80)
    },
    menus: {
      header: menu(d.menus?.header, D.menus.header, 7),
      help: menu(d.menus?.help, D.menus.help, 8),
      company: menu(d.menus?.company, D.menus.company, 8)
    }
  };
}

/** Age shortcuts for the "Shop by age" section; they link to the shop's age filter. */
export const AGE_RANGES = [
  { label: '0–2', note: 'Babies & toddlers', min: 0, max: 2, icon: '🍼' },
  { label: '3–5', note: 'Preschool', min: 3, max: 5, icon: '🧸' },
  { label: '6–8', note: 'Young explorers', min: 6, max: 8, icon: '🚀' },
  { label: '9–12', note: 'Big kids', min: 9, max: 12, icon: '🧩' },
  { label: '13+', note: 'Teens & family', min: 13, max: null, icon: '🎲' }
];

/**
 * A pleasant stand-in when a product or category has no photo: a soft colour and toy emoji that are
 * always the same for the same name, so the grid looks intentional rather than empty.
 */
export function placeholderFor(name: string) {
  let hash = 0;
  for (const ch of String(name || 'toy')) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  const emoji = ['🧸', '🚂', '🧩', '🎨', '🪀', '🚀', '🦖', '🎲', '🪁', '🧱', '🎈', '🦄'][hash % 12];
  const hue = [12, 32, 48, 145, 170, 200, 222, 255, 285, 330][Math.floor(hash / 12) % 10];
  return { emoji, hue };
}

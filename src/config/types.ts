/**
 * Single source of truth for all entity + page-config types.
 * Discriminated unions are used so future Prisma models can map 1:1.
 */

// ─── Document slot (Phase 3) ───
// Public-side projection of a DocumentSlot + its linked MediaAsset (when set).
// The assembler populates this from getDocumentSlotWithMedia; public sections
// hide their download button when `media` is null.
export interface DocumentSlotMedia {
  id: string;
  kind: 'image' | 'pdf';
  publicId: string;
  filename: string;
  sizeBytes: number;
  alt: string | null;
}
export type DocumentSlotPublic = { id: string; media: DocumentSlotMedia | null } | null;

// ─── Shared primitives ───

export interface CtaLink {
  label: string;
  href: string;
  icon?: string;
}

export interface CtaFinal {
  title: string;
  titleLines?: string[];
  subtitle: string;
  primary: CtaLink;
  secondary?: CtaLink;
}

export interface SectionMeta {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}

// ─── Site-wide config ───

export type Route =
  | '/'
  | '/profil'
  | '/akademik'
  | '/fasilitas'
  | '/kontak';

export interface NavItem {
  label: string;
  href: Route;
}

export type SocialPlatform = 'instagram' | 'facebook' | 'youtube' | 'tiktok';

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
  handle: string;
  icon: string;
  cta: string;
}

export interface ContactInfo {
  /** TODO: replace with real data */
  address: string;
  /** TODO: replace with real data */
  addressLines: string[];
  /** TODO: replace with real data */
  phone: string;
  /** TODO: replace with real data */
  phoneHref: string;
  /** TODO: replace with real data */
  whatsapp: string;
  /** TODO: replace with real data */
  email: string;
  hours: string;
  hoursDetail: string;
  mapsUrl: string;
  directionsUrl: string;
}

export interface AccreditationInfo {
  grade: 'A' | 'B' | 'C';
  body: string;
  label: string;
}

export interface BrandInfo {
  name: string;
  shortName: string;
  location: string;
  tagline: string;
  logoMark: string;
}

export interface FooterCredit {
  copyright: string;
  designedBy: string;
}

export interface SiteConfig {
  brand: BrandInfo;
  navigation: NavItem[];
  kontakCta: { label: string; href: string };
  contact: ContactInfo;
  social: SocialLink[];
  accreditation: AccreditationInfo;
  footer: FooterCredit;
}

// ─── Entity types ───

export type AchievementLevel =
  | 'kabupaten'
  | 'provinsi'
  | 'nasional'
  | 'internasional';

export interface Achievement {
  id: string;
  year: number;
  title: string;
  recipient: string;
  organizer: string;
  level: AchievementLevel;
  /**
   * Phase 3b: discriminated union — gradient kind keeps the trophy/medal emoji
   * (now hosted as photo.emoji); url kind supports sertifikat/photo uploads.
   */
  photo: Photo;
}

export type TeacherCategory = 'pimpinan' | 'guru' | 'tu';

export type Photo =
  | {
      kind: 'url';
      src: string;
      alt: string;
      // Phase 4: normalized crop region (0–1 fractions of the source image).
      // All four present together = a crop; all absent = render uncropped
      // (legacy/center-fill behaviour). cropW/cropH double as zoom (smaller =
      // more zoomed in).
      //
      // NOTE: this type is a deliberate SUPERSET of what is valid. The real
      // bounds (0–1 range, ≥0.05 size, all-or-nothing, x+w≤1 / y+h≤1) live in
      // `photoSchema` (src/lib/validation/schemas/shared.ts) — Zod is the source
      // of truth. Render-time safety is guaranteed by `cropOf()` in cldUrl.ts,
      // which only returns a crop when all four are present.
      //
      // The `| undefined` is explicit (not just `?`) so the type matches Zod's
      // `.optional()` inference under exactOptionalPropertyTypes.
      cropX?: number | undefined;
      cropY?: number | undefined;
      cropW?: number | undefined;
      cropH?: number | undefined;
    }
  | { kind: 'gradient'; from: string; to: string; emoji: string };

export interface Teacher {
  id: string;
  name: string;
  position: string;
  badge: string;
  category: TeacherCategory;
  photo: Photo;
}

export type EkskulCategory =
  | 'wajib'
  | 'olahraga'
  | 'seni'
  | 'akademik'
  | 'keagamaan'
  | 'lainnya';

export interface Extracurricular {
  id: string;
  name: string;
  category: EkskulCategory;
  description: string;
  pembina: string;
  schedule: string;
  achievement?: string;
  /**
   * Phase 3b: discriminated union — gradient kind keeps the legacy emoji
   * (now hosted as photo.emoji); url kind supports Cloudinary uploads.
   */
  photo: Photo;
}

export type FaqCategory = 'akademik' | 'administrasi' | 'lainnya';

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: FaqCategory;
}

export interface GalleryItem {
  id: string;
  caption: string;
  /**
   * Phase 3b: discriminated union — `kind: 'gradient'` (legacy seed default)
   * stores emoji + from/to colours; `kind: 'url'` stores a Cloudinary publicId
   * + alt text. Public render goes through `cldUrl(photo.src, 'card')`.
   */
  photo: Photo;
  category?: string;
  span?: 'wide' | 'tall' | 'normal';
}

// Contact card variants on the home/kontak pages.
export type ContactCard =
  | { kind: 'address'; icon: string; label: string; value: string; sub: string; href?: string; linkText?: string }
  | { kind: 'phone'; icon: string; label: string; value: string; sub: string; href: string; linkText?: string }
  | { kind: 'email'; icon: string; label: string; value: string; sub: string; href: string; linkText?: string }
  | { kind: 'hours'; icon: string; label: string; value: string; sub: string; subTone?: 'muted' | 'warn' };

// ─── Home page ───

export interface HeroConfig {
  badge: string;
  titleLine1: string;
  titleLine2: string;
  subtitle: string;
  description: string;
  primary: CtaLink;
  secondary: CtaLink;
  scrollLabel: string;
  // Phase 5: optional admin-set faded background photo; absent = brand gradient.
  photo?: Photo | undefined;
}

export interface StatCard {
  id: string;
  icon: string;
  iconBg: string;
  value: string;
  numeric?: number;
  suffix?: string;
  label: string;
}

export interface SambutanConfig {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  /** TODO: replace with real data */
  signatureName: string;
  signatureTitle: string;
  photoPlaceholderText: string;
  photoEmoji: string;
  // Phase 5: optional admin-set photo; absent = gradient/emoji placeholder.
  photo?: Photo | undefined;
}

export interface AboutConfig {
  eyebrow: string;
  titleLines: string[];
  paragraphs: string[];
  checks: string[];
  cta: CtaLink;
  badge: string;
  photoMainText: string;
  photoSubText: string;
  // Phase 5: optional admin-set photos; absent = gradient/emoji placeholder.
  photoMain?: Photo | undefined;
  photoSub?: Photo | undefined;
}

export interface ProgramCard {
  id: string;
  icon: string;
  iconBg: string;
  title: string;
  description: string;
  href: string;
  linkText: string;
}

export interface HomePageConfig {
  hero: HeroConfig;
  stats: { meta: SectionMeta; cards: StatCard[] };
  sambutan: SambutanConfig;
  about: AboutConfig;
  programs: { meta: SectionMeta; cards: ProgramCard[] };
  gallery: { meta: SectionMeta; items: GalleryItem[]; ctaLabel: string; ctaHref: string };
  achievements: { meta: SectionMeta; items: Achievement[]; ctaLabel: string; ctaHref: string };
  lokasi: {
    meta: SectionMeta;
    panelTitle: string;
    panelDescription: string;
    cards: ContactCard[];
    primary: CtaLink;
    secondary: CtaLink;
    /** Address string to be copied when secondary action is triggered */
    copyText: string;
  };
  ctaFinal: CtaFinal;
}

// ─── Profil page ───

export interface TimelineItem {
  id: string;
  marker: string;
  text: string;
}

export interface VisiMisiConfig {
  meta: SectionMeta;
  visi: { icon: string; label: string; statement: string };
  misi: { icon: string; label: string; items: string[] };
}

export interface ObjectiveCard {
  id: string;
  number: string;
  title: string;
  description: string;
}

export interface IdentityRow {
  label: string;
  value: string;
  badge?: 'negeri' | 'akreditasi';
}

export interface OrgChartLevel {
  id: string;
  boxes: { name: string; title: string }[];
}

export interface OrgChartConfig {
  levels: OrgChartLevel[];
  studentNote: string;
}

export interface PageHeaderConfig {
  breadcrumb: { label: string; href?: string }[];
  title: string;
  subtitle: string;
}

export interface ProfilePageConfig {
  pageHeader: PageHeaderConfig;
  sejarah: {
    eyebrow: string;
    title: string;
    paragraphs: string[];
    photoPlaceholderText: string;
    photoEmoji: string;
    timeline: TimelineItem[];
    // Phase 5: optional admin-set photo; absent = gradient/emoji placeholder.
    photo?: Photo | undefined;
  };
  visiMisi: VisiMisiConfig;
  tujuan: { meta: SectionMeta; cards: ObjectiveCard[] };
  identitas: { meta: SectionMeta; rows: IdentityRow[] };
  struktur: { meta: SectionMeta; chart: OrgChartConfig };
  guru: {
    meta: SectionMeta;
    filterLabels: { all: string; pimpinan: string; guru: string; tu: string };
    teachers: Teacher[];
  };
  prestasi: { meta: SectionMeta; items: Achievement[] };
  ctaFinal: CtaFinal;
}

// ─── Akademik page ───

export interface SubjectCard {
  id: string;
  name: string;
  icon: string;
  iconBg: string;
  hours: string;
}

export interface SubjectGroup {
  id: string;
  title: string;
  subjects: SubjectCard[];
}

export interface ScheduleCard {
  id: string;
  icon: string;
  bgClass: 'primary' | 'secondary';
  title: string;
  items: string[];
}

export interface MethodCard {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface AssessmentCard {
  id: string;
  icon: string;
  title: string;
  description: string;
  badge: string;
}

export type CalendarEventType = 'kbm' | 'ujian' | 'libur' | 'acara';

export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  type: CalendarEventType;
  typeLabel: string;
  sub: string;
}

export interface KurikulumConfig {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  chips: string[];
  floatStat: { value: string; label: string };
  photoEmoji: string;
  photoPlaceholderText: string;
  // Phase 5: optional admin-set photo; absent = gradient/emoji placeholder.
  photo?: Photo | undefined;
}

export interface AcademicPageConfig {
  pageHeader: PageHeaderConfig;
  kurikulum: KurikulumConfig;
  mapel: {
    meta: SectionMeta;
    tabs: { id: 'kelas7' | 'kelas8' | 'kelas9'; label: string; groups: SubjectGroup[] }[];
  };
  jadwal: { meta: SectionMeta; cards: ScheduleCard[]; note: string };
  metode: { meta: SectionMeta; cards: MethodCard[] };
  penilaian: { meta: SectionMeta; intro: string; cards: AssessmentCard[] };
  kalender: { meta: SectionMeta; events: CalendarEvent[]; documentSlot: DocumentSlotPublic };
  ctaFinal: CtaFinal;
}

// ─── Fasilitas page ───

export interface FacilityCard {
  id: string;
  name: string;
  description: string;
  /**
   * Phase 3b: featured kind's photo is a Photo discriminated union.
   * Gradient branch is the legacy default; url branch supports uploads.
   */
  photo: Photo;
  span?: 'wide' | 'tall' | 'normal';
}

export interface FacilityMini {
  id: string;
  icon: string;
  name: string;
}

export interface KegiatanCard {
  id: string;
  icon: string;
  title: string;
  frequency: string;
  description: string;
}

export interface AccordionContent {
  id: string;
  icon: string;
  title: string;
  items: string[];
}

export interface FacilitiesPageConfig {
  pageHeader: PageHeaderConfig;
  sarana: {
    meta: SectionMeta;
    statStrip: { value: string; label: string }[];
    featured: FacilityCard[];
    mini: FacilityMini[];
  };
  ekskul: {
    meta: SectionMeta;
    statStrip: { value: string; label: string }[];
    filterLabels: Partial<Record<EkskulCategory, string>> & { all: string };
    items: Extracurricular[];
  };
  kegiatan: { meta: SectionMeta; cards: KegiatanCard[] };
  galeri: {
    meta: SectionMeta;
    filterLabels: { all: string; akademik: string; ekskul: string; acara: string; fasilitas: string };
    items: GalleryItem[];
  };
  tatib: { meta: SectionMeta; accordions: AccordionContent[]; documentSlot: DocumentSlotPublic };
  ctaFinal: CtaFinal;
}

// ─── Kontak page ───

export interface ContactFormConfig {
  eyebrow: string;
  title: string;
  intro: string;
  noteIcon: string;
  noteText: string;
  fields: {
    nama: { label: string; placeholder: string; required: true; errorMessage: string };
    email: { label: string; placeholder: string; required: true; errorMessage: string };
    telp: { label: string; placeholder: string; required: true; errorMessage: string };
    subjek: { label: string; placeholder: string; required: true; errorMessage: string; options: string[] };
    pesan: { label: string; placeholder: string; required: true; errorMessage: string };
  };
  agreement: { label: string; required: true; errorMessage: string };
  waButtonLabel: string;
  emailButtonLabel: string;
  helperText: string;
  /** WhatsApp number in international format without "+", e.g. 6221592212345 */
  waNumber: string;
  /** Email recipient address */
  emailTo: string;
  waMessageTemplate: string;
  emailSubjectTemplate: string;
  emailBodyTemplate: string;
}

export interface FaqConfig {
  meta: SectionMeta;
  searchPlaceholder: string;
  filterLabels: { all: string; akademik: string; administrasi: string; lainnya: string };
  items: Faq[];
  noResultsText: string;
  ctaText: string;
  ctaHref: string;
}

export interface ContactPageConfig {
  pageHeader: PageHeaderConfig;
  kontakInfo: {
    meta: SectionMeta;
    cards: ContactCard[];
    socialHeading: string;
    socialSub: string;
  };
  peta: {
    meta: SectionMeta;
    placeholderText: string;
    primaryAction: CtaLink;
    secondaryAction: CtaLink;
  };
  form: ContactFormConfig;
  faq: FaqConfig;
  ctaFinal: CtaFinal;
}

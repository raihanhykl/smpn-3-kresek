# SMPN 3 Kresek — Website

Website resmi **SMP Negeri 3 Kresek** (Kecamatan Kresek, Kabupaten Tangerang, Banten) — dibangun sebagai bagian dari project PKM (Pengabdian kepada Masyarakat).

Site ini adalah static-export Next.js dengan content yang **fully config-driven**: non-developer bisa mengedit semua copy, daftar guru, ekstrakurikuler, prestasi, FAQ, dst. hanya dengan menyentuh file di `src/config/`.

---

## Tech stack

- **Next.js 15** (App Router) dengan `output: 'export'`
- **React 19 + TypeScript** strict mode (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`)
- **Tailwind CSS** (theme di-extend mengikuti design system)
- **Jest + React Testing Library** (jsdom)
- **Node ≥ 18.17** (direkomendasikan 22.x — lihat `.nvmrc`)

---

## Prerequisites

- Node.js ≥ 18.17 (di-pin ke 22.22.0 via `.nvmrc` / `.node-version`)
- npm ≥ 10

```bash
nvm use   # pakai versi Node yang sudah di-pin
```

## Setup

```bash
git clone <repo-url>
cd smpn-3-kresek
nvm use
npm ci
```

## Development

```bash
npm run dev          # http://localhost:3000
```

## Production build (static export)

```bash
npm run build        # output → ./out/
npx serve out        # serve hasil build secara lokal
```

`./out/` adalah folder static yang siap di-upload ke S3 / Netlify / Vercel / Cloudflare Pages tanpa server runtime.

## Verification on a fresh clone

Urutan command persis yang harus berjalan tanpa error dan tanpa warning:

```bash
rm -rf node_modules .next out
nvm use
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npx serve out
```

## Scripts

| Script | Fungsi |
|---|---|
| `npm run dev` | Dev server (port 3000) |
| `npm run build` | Production build + static export ke `out/` |
| `npm run lint` | ESLint (`--max-warnings=0`) |
| `npm run typecheck` | `tsc --noEmit` strict mode |
| `npm test` | Jalankan unit + component tests |
| `npm run test:ci` | Tests + coverage report |
| `npm run format` | Prettier check |

---

## Content editing guide (untuk non-developer)

Semua copy, foto placeholder, daftar guru, ekstrakurikuler, FAQ, prestasi, dst. ada di typed config files. Edit file-nya, save, dan dev server otomatis reload.

| Yang ingin diubah | File yang di-edit |
|---|---|
| Nama sekolah, alamat, telepon, email, sosial media, akreditasi | [`src/config/site.ts`](./src/config/site.ts) |
| Menu navigasi | [`src/config/navigation.ts`](./src/config/navigation.ts) |
| Halaman **Beranda** (hero, stats, sambutan kepsek, program, galeri, prestasi, lokasi) | [`src/config/pages/home.ts`](./src/config/pages/home.ts) |
| Halaman **Profil** (sejarah, visi-misi, tujuan, identitas, struktur organisasi, guru, prestasi) | [`src/config/pages/profil.ts`](./src/config/pages/profil.ts) |
| Halaman **Akademik** (kurikulum, mata pelajaran per kelas, jadwal, metode, penilaian, kalender) | [`src/config/pages/akademik.ts`](./src/config/pages/akademik.ts) |
| Halaman **Fasilitas** (sarana, ekstrakurikuler, kegiatan rutin, galeri, tata tertib) | [`src/config/pages/fasilitas.ts`](./src/config/pages/fasilitas.ts) |
| Halaman **Kontak** (info kontak, form WhatsApp/email, FAQ) | [`src/config/pages/kontak.ts`](./src/config/pages/kontak.ts) |

### Contoh: mengganti nomor telepon sekolah

1. Buka [`src/config/site.ts`](./src/config/site.ts)
2. Ubah field `contact.phone` dan `contact.phoneHref`
3. Save → footer, halaman Kontak, dan section Lokasi di Beranda akan otomatis update

### Contoh: menambahkan guru baru

1. Buka [`src/config/pages/profil.ts`](./src/config/pages/profil.ts)
2. Tambah object baru ke array `guru.teachers`:
   ```ts
   { id: 'g8', name: 'Nama Guru', position: 'Guru Bahasa Daerah', badge: 'S.Pd.',
     category: 'guru', photo: { kind: 'gradient', from: '#DBEAFE', to: '#93C5FD', emoji: '👨‍🏫' } }
   ```
3. Save

Field yang ditandai `// TODO: replace with real data` di config adalah placeholder yang menunggu diisi data riil (Nama Kepala Sekolah, NPSN, koordinat lokasi, dsb).

### Mengganti placeholder PDF

Letakkan PDF asli di `public/docs/`:
- `kalender-akademik.pdf` — tombol "Unduh Kalender Akademik" di halaman Akademik
- `tata-tertib.pdf` — tombol "Unduh Buku Tata Tertib" di halaman Fasilitas

---

## Architecture overview

Atomic design + data abstraction:

```
src/
├── app/                Next App Router pages (5 routes + (admin) gated)
├── components/
│   ├── atoms/          Button, Badge, SectionHeading, IconBox, TextLink, …
│   ├── molecules/      Cards, Accordion, Tabs, Breadcrumb, …
│   ├── organisms/      Per-page section components (Navbar, Footer, HeroSection, …)
│   └── templates/      PageLayout (composes Navbar + main + Footer + BackToTop)
├── config/
│   ├── types.ts        Single source-of-truth untuk semua entity + page types
│   ├── site.ts, navigation.ts
│   └── pages/          Per-route content (home, profil, akademik, fasilitas, kontak)
├── lib/
│   ├── data/           ContentProvider interface + Static + Api stub + factory
│   ├── hooks/          useScrollY, useScrollReveal, useCountUp, useCarousel, useAccordion
│   └── utils/          cn, buildWhatsAppUrl, buildMailtoUrl, validateContactForm
├── styles/globals.css
└── __tests__/          Unit + component tests
```

Each page file is a thin server component yang `await getContentProvider().getXxxPage()` lalu memberikan slice config bertipe ke organism sections. **Tidak ada hardcoded Indonesian string di JSX** — semuanya berasal dari config.

---

## Data abstraction (siap untuk backend masa depan)

Semua data dibaca melalui satu interface:

```ts
// src/lib/data/ContentProvider.ts
interface ContentProvider {
  getSiteConfig():     Promise<SiteConfig>;
  getHomePage():       Promise<HomePageConfig>;
  getProfilePage():    Promise<ProfilePageConfig>;
  getAcademicPage():   Promise<AcademicPageConfig>;
  getFacilitiesPage(): Promise<FacilitiesPageConfig>;
  getContactPage():    Promise<ContactPageConfig>;
}
```

Saat ini terdapat dua implementasi:

- `StaticContentProvider` — membaca dari typed configs di `src/config/`. Aktif saat `NEXT_PUBLIC_DATA_SOURCE=static` (default).
- `ApiContentProvider` — **stub** untuk future Node/Express/Prisma/Postgres backend. Setiap method-nya melempar "not implemented yet".

Factory `getContentProvider()` membaca env var dan mengembalikan implementasi yang sesuai (di-cache untuk lifetime process).

### Future backend integration

Saat backend siap:

1. Implementasikan setiap method di [`src/lib/data/ApiContentProvider.ts`](./src/lib/data/ApiContentProvider.ts) dengan `fetch` ke endpoint `${baseUrl}/...`.
2. Mapping response JSON ke shape `HomePageConfig` / `ProfilePageConfig` / dst. (semua sudah ditipekan di [`src/config/types.ts`](./src/config/types.ts)).
3. Set env var:
   ```bash
   NEXT_PUBLIC_DATA_SOURCE=api
   NEXT_PUBLIC_API_BASE_URL=https://api.smpn3kresek.sch.id/v1
   ```
4. Tidak ada perubahan di sisi UI: setiap page sudah `await provider.getXxxPage()`.

### Future Prisma schema sketch

Entity shapes di `types.ts` sudah didesain agar mapping ke Postgres tabel realistis:

- `Teacher` → `teachers (id, name, position, badge, category, photo_kind, photo_src, ...)`
- `Achievement` → `achievements (id, year, title, recipient, organizer, level, icon)`
- `Extracurricular` → `extracurriculars (id, name, category, description, pembina, schedule, achievement, icon)`
- `Faq` → `faqs (id, question, answer, category)`
- `GalleryItem`, `ContactCard`, dst.

Field-field bersifat scalar dan menggunakan discriminated `kind` union daripada nested polymorphism, sehingga ramah Prisma.

---

## Admin route group

Folder `src/app/(admin)/` sudah disiapkan tapi belum diimplementasikan.

`src/app/(admin)/layout.tsx` memanggil `notFound()` jika `NEXT_PUBLIC_DATA_SOURCE !== 'api'`, jadi pada static build (default), URL `/admin` resolve ke halaman 404 global — build tetap clean, tidak ada error.

Saat backend + autentikasi siap:
1. Switch `NEXT_PUBLIC_DATA_SOURCE=api`.
2. Implementasi UI CRUD per entity di bawah `src/app/(admin)/admin/*`.
3. Tambahkan auth guard (NextAuth, Clerk, atau custom token check di layout).

---

## Testing

```bash
npm test                 # 51 tests across utils, data, hooks, components
npm run test:ci          # + coverage report
```

Threshold: ≥ 70% coverage pada `src/lib/`. Yang ditest:

- **Utilities** (`buildWhatsAppUrl`, `buildMailtoUrl`, `validateContactForm`, `cn`) — pure functions, edge cases, encoding.
- **Data layer** — factory selector, Static provider returns expected configs, Api stub throws.
- **Hooks** — `useAccordion`, `useCarousel`, `useScrollY`, `useCountUp`, `useScrollReveal` (single/multi modes, wrap-around, threshold, fallback).
- **Components** — atoms (Button, BadgeLevel) dan molecules (ContactCard, FilterTabs) — rendering, variants, accessibility, event handlers.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_DATA_SOURCE` | `static` | `static` atau `api`. Static → membaca dari config. Api → mengaktifkan `ApiContentProvider` dan route `/admin`. |
| `NEXT_PUBLIC_API_BASE_URL` | `''` | Base URL untuk `ApiContentProvider`. Tidak terpakai dalam mode static. |

Copy [`.env.example`](./.env.example) ke `.env.local` untuk overrides lokal.

---

## Deployment

Karena `output: 'export'`, `./out/` adalah folder static yang siap di-host:

### Vercel
1. Import repo ke Vercel.
2. Framework preset: **Next.js**.
3. Build command: `npm run build`. Output dir: `out/` (auto-detect).

### Netlify
1. Build command: `npm run build`.
2. Publish directory: `out/`.

### S3 + CloudFront
```bash
npm run build
aws s3 sync out/ s3://your-bucket/ --delete
```

### Cloudflare Pages
1. Build command: `npm run build`.
2. Build output directory: `out`.

````markdown
### Hostinger VPS deployment

One-time setup on VPS (Ubuntu 22.04+ assumed):

```bash
# Install Node 22 via nvm + PM2 + Postgres
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 22.22.0 && nvm use 22.22.0 && nvm alias default 22.22.0
npm i -g pm2

# Postgres (Ubuntu)
sudo apt-get install -y postgresql-16
sudo -u postgres psql -c "CREATE DATABASE smpn3;"
sudo -u postgres psql -c "CREATE USER smpn3 WITH ENCRYPTED PASSWORD 'change-me';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE smpn3 TO smpn3;"

# Clone repo
sudo mkdir -p /opt/smpn3 && sudo chown $USER /opt/smpn3
git clone <repo> /opt/smpn3/app
cd /opt/smpn3/app

# Env vars
cp .env.example .env.local
# Edit .env.local — set DATABASE_URL, AUTH_SECRET (openssl rand -base64 32), AUTH_URL

# First deploy
bash scripts/deploy.sh

# Start with PM2 (NODE_ENV=production is implicit because `next start` defaults to production)
pm2 start npm --name smpn3 -- start
pm2 save
pm2 startup  # follow printed instructions

# Seed first admin
npm run db:seed
# Note the temporary password printed; share via WhatsApp; user changes on first login.
```

Once SSH access is set up, configure GitHub repo secrets `SSH_HOST`, `SSH_USER`, `SSH_KEY` and add the deploy job to `.github/workflows/ci.yml`:

```yaml
  deploy:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: [build, integration, e2e]
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: bash /opt/smpn3/deploy.sh
```

**Rollback**: SSH into VPS, `cd /opt/smpn3/app && git reset --hard <previous-good-commit-sha> && bash scripts/deploy.sh`. Migrations are not rolled back automatically — use Prisma migration files to author a reverse migration if schema needs to revert.
````

---

## Notes

- Semua image saat ini adalah emoji-on-gradient placeholders (lihat discriminated `Photo` type di `types.ts`). Untuk swap ke foto asli, ubah `kind: 'gradient'` ke `kind: 'url'` + isi `src` dan `alt` pada item di config.
- Placeholder PDFs di `public/docs/` minimal — replace dengan PDF asli kalender akademik dan tata tertib saat tersedia.
- Map embed di section Lokasi dan halaman Kontak adalah block placeholder. Untuk embed Google Maps iframe asli, edit field map di config (sudah disiapkan slot URL-nya).

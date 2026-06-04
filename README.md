# Website SMP Negeri 3 Kresek

Website resmi SMP Negeri 3 Kresek (Kecamatan Kresek, Kabupaten Tangerang, Banten). Selain menampilkan profil dan informasi sekolah ke publik, situs ini punya panel admin sehingga staf sekolah bisa memperbarui kontennya sendiri tanpa perlu menyentuh kode.

Dikerjakan sebagai bagian dari program PKM (Pengabdian kepada Masyarakat).

![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)

## Daftar isi

- [Fitur](#fitur)
- [Teknologi](#teknologi)
- [Menjalankan secara lokal](#menjalankan-secara-lokal)
- [Scripts](#scripts)
- [Mengelola konten](#mengelola-konten)
- [Arsitektur](#arsitektur)
- [Deployment](#deployment)
- [Testing](#testing)

## Fitur

- **Situs publik** dengan halaman Beranda, Profil, Akademik, Fasilitas, Mading, dan Kontak.
- **Panel admin** dengan login (NextAuth v5 + bcrypt), pemaksaan ganti password saat login pertama, dan audit log untuk setiap perubahan.
- **CRUD dari UI** untuk guru, prestasi, ekstrakurikuler, mata pelajaran, FAQ, galeri, fasilitas, struktur organisasi, mading, dan slot dokumen. Apa yang diubah admin langsung tampil di situs publik.
- **Media library** berbasis Cloudinary: unggah foto, crop dan atur posisi, lacak di mana sebuah media dipakai, lalu hapus atau lepaskan tanpa meninggalkan file yatim.
- **Slot dokumen PDF** yang bisa diisi dari admin, misalnya untuk kalender pendidikan.

## Teknologi

- Next.js 15 (App Router) dengan server runtime
- React 19 dan TypeScript dalam mode strict
- MySQL 8 melalui Prisma 6
- NextAuth v5 (pemisahan Edge/Node) dan bcrypt untuk autentikasi
- Cloudinary untuk penyimpanan dan transformasi gambar
- Zod dan react-hook-form untuk validasi form
- dnd-kit untuk pengurutan entitas
- Tailwind CSS 3
- Jest dan Playwright untuk pengujian

## Menjalankan secara lokal

### Prasyarat

- Node.js 22.x (versinya di-pin di `.nvmrc`; minimal 18.17)
- npm 10 atau lebih baru
- MySQL 8 yang berjalan secara lokal
- Akun Cloudinary (free tier cukup) jika ingin memakai fitur unggah foto

### Langkah

```bash
git clone <repo-url>
cd smpn-3-kresek
nvm use
npm ci
```

Salin file environment lalu isi nilainya:

```bash
cp .env.example .env.local
```

| Variable                                      | Keterangan                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                | Koneksi MySQL, mis. `mysql://user:pass@localhost:3306/smpn_3_kresek_pkm` (tanpa `?schema=`) |
| `TEST_DATABASE_URL`                           | Database terpisah untuk test — test menjalankan wipe dan seed yang destruktif               |
| `AUTH_SECRET`                                 | Buat dengan `openssl rand -base64 32`                                                       |
| `AUTH_URL`                                    | `http://localhost:3000` saat lokal; URL produksi saat deploy                                |
| `NEXT_PUBLIC_DATA_SOURCE`                     | Set ke `api` agar situs membaca data dari database                                          |
| `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Kredensial Cloudinary; secret harus tetap di sisi server                                    |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`           | Nama cloud, ikut muncul di setiap URL media                                                 |

Siapkan database, lalu jalankan dev server:

```bash
npm run db:migrate        # terapkan skema
npm run db:seed:content   # isi data awal dari src/config/ (idempotent)
npm run db:seed           # buat admin pertama; password sementara tercetak di terminal
npm run dev
```

Situs publik ada di `http://localhost:3000` dan login admin di `http://localhost:3000/admin`.

## Scripts

| Script                      | Fungsi                                       |
| --------------------------- | -------------------------------------------- |
| `npm run dev`               | Dev server di port 3000                      |
| `npm run build`             | Generate Prisma client lalu build produksi   |
| `npm start`                 | Jalankan server produksi                     |
| `npm run lint`              | ESLint (`--max-warnings=0`)                  |
| `npm run typecheck`         | `tsc --noEmit`                               |
| `npm test`                  | Unit dan component test                      |
| `npm run test:int`          | Integration test (butuh `TEST_DATABASE_URL`) |
| `npm run e2e`               | Playwright end-to-end                        |
| `npm run db:migrate`        | Terapkan migrasi (dev)                       |
| `npm run db:migrate:deploy` | Terapkan migrasi (produksi)                  |
| `npm run db:seed`           | Seed admin pertama                           |
| `npm run db:seed:content`   | Seed konten dari `src/config/`               |
| `npm run db:studio`         | Buka Prisma Studio                           |

## Mengelola konten

Konten dibagi dua: teks statis dan struktur situs hidup di kode, sedangkan data yang sering berubah hidup di database.

**Lewat panel admin** (untuk staf sekolah). Sebagian besar isi situs dikelola dari `/admin` tanpa menyentuh kode: login, pilih entitas di sidebar (guru, prestasi, galeri, dan seterusnya), lalu tambah, ubah, hapus, urutkan dengan drag, atau unggah foto. Perubahan langsung tampil di situs publik.

**Lewat config** (untuk developer). Teks statis, branding, dan navigasi ada di file config bertipe:

| Yang diubah                                                    | File                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| Nama sekolah, alamat, telepon, email, sosial media, akreditasi | [`src/config/site.ts`](./src/config/site.ts)             |
| Menu navigasi                                                  | [`src/config/navigation.ts`](./src/config/navigation.ts) |
| Teks per halaman (Profil, Akademik, Fasilitas, Kontak)         | [`src/config/pages/`](./src/config/pages/)               |

Field yang diberi komentar `// TODO: replace with real data` adalah placeholder yang masih menunggu data riil, seperti NPSN dan koordinat lokasi.

## Arsitektur

Halaman publik tidak membaca database atau config secara langsung. Keduanya disatukan di balik satu lapisan `ContentProvider`, jadi sumber datanya bisa berganti tanpa mengubah komponen halaman.

```
src/
├── app/
│   ├── (admin)/      Panel admin (login, dashboard, entities, media), dijaga auth
│   ├── profil/ akademik/ fasilitas/ mading/ kontak/   Halaman publik
│   ├── api/          Route handlers
│   └── page.tsx      Beranda
├── components/       Atoms, molecules, organisms, templates
├── config/
│   ├── site.ts, navigation.ts    Teks statis dan menu
│   └── pages/                     Teks per halaman
├── lib/
│   ├── data/         ContentProvider, repositories, assemblers
│   ├── auth/         Konfigurasi NextAuth (pemisahan Edge/Node)
│   ├── db/           Prisma client
│   ├── media/        Cloudinary, pelacakan penggunaan media, crop
│   ├── security/     Guard dan rate limit
│   └── validation/   Skema Zod
├── middleware.ts     Auth guard untuk /admin
└── __tests__/

prisma/schema.prisma  User, Session, AuditLog, Teacher, Achievement,
                      Extracurricular, Subject, Faq, Mading, GalleryItem,
                      Facility, OrganizationMember, DocumentSlot,
                      SectionPhoto, MediaAsset, MediaUsage
```

Pembagian sumber konten:

| Jenis konten                                                            | Sumber               | Cara edit   |
| ----------------------------------------------------------------------- | -------------------- | ----------- |
| Teks statis, navigasi, branding                                         | `src/config/`        | Edit kode   |
| Guru, prestasi, ekskul, mapel, FAQ, galeri, fasilitas, struktur, mading | MySQL                | Panel admin |
| Foto section halaman                                                    | MySQL dan Cloudinary | Panel admin |

## Deployment

Aplikasi berjalan sebagai server runtime (bukan static export), di-deploy ke Hostinger VPS dengan PM2, dan dipicu oleh GitHub Actions saat ada push ke `main`. Alur lengkapnya ada di [`scripts/deploy.sh`](./scripts/deploy.sh) dan bersifat atomic: kalau salah satu langkah gagal, build lama tetap berjalan.

Garis besar langkahnya:

```bash
git reset --hard origin/main
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 reload smpn3
```

Beberapa catatan khusus Hostinger:

- `DATABASE_URL` harus memakai `127.0.0.1:3306`, bukan `localhost`, dan menambahkan `connection_limit=1` agar Prisma tidak error.
- Seed konten tidak dijalankan pada deploy rutin. Produksi menyimpan data riil yang dimasukkan sekolah lewat admin, dan seed entitas bersifat create-only sehingga tidak menimpa hasil edit.

Untuk rollback, SSH ke VPS lalu `git reset --hard <commit-sebelumnya> && bash scripts/deploy.sh`. Migrasi tidak otomatis dikembalikan; buat reverse migration bila skema perlu diundur.

## Testing

```bash
npm test           # unit dan component test
npm run test:int   # integration test, butuh TEST_DATABASE_URL
npm run e2e        # Playwright end-to-end
```

Coverage di `src/lib/` dijaga minimal 70%.

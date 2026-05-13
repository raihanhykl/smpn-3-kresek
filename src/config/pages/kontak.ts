import type { ContactPageConfig } from '../types';

export const kontakPageConfig: ContactPageConfig = {
  pageHeader: {
    breadcrumb: [
      { label: 'Beranda', href: '/' },
      { label: 'Kontak' },
    ],
    title: 'Hubungi Kami',
    subtitle: 'Kami siap menjawab pertanyaan dan memberikan informasi yang Anda butuhkan',
  },
  kontakInfo: {
    meta: {
      eyebrow: 'INFORMASI KONTAK',
      title: 'Cara Menghubungi Kami',
      subtitle: 'Jangan ragu untuk menghubungi kami melalui salah satu saluran berikut',
    },
    cards: [
      {
        kind: 'address',
        icon: '📍',
        label: 'Alamat Sekolah',
        value: 'Jl. Raya Kresek No. 15, Kresek',
        sub: 'Kabupaten Tangerang, Banten 15620',
        href: 'https://maps.google.com',
        linkText: 'Lihat di Google Maps →',
      },
      {
        kind: 'phone',
        icon: '📞',
        label: 'Telepon',
        value: '(021) 5922-1234',
        sub: 'Senin – Jumat, 07.00 – 15.00 WIB',
        href: 'tel:+62215922-1234',
        linkText: 'Telepon Sekarang →',
      },
      {
        kind: 'email',
        icon: '✉️',
        label: 'Email',
        value: 'info@smpn3kresek.sch.id',
        sub: 'Respon dalam 1×24 jam kerja',
        href: 'mailto:info@smpn3kresek.sch.id',
        linkText: 'Kirim Email →',
      },
      {
        kind: 'hours',
        icon: '🕐',
        label: 'Jam Pelayanan',
        value: 'Senin – Jumat: 07.00 – 15.00 WIB',
        sub: 'Minggu & Libur Nasional: Tutup',
        subTone: 'warn',
      },
    ],
    socialHeading: 'Ikuti Kami di Media Sosial',
    socialSub: 'Dapatkan update kegiatan dan informasi terkini sekolah',
  },
  peta: {
    meta: {
      eyebrow: 'LOKASI',
      title: 'Temukan Kami di Sini',
      subtitle: 'Kunjungi sekolah kami untuk konsultasi, informasi PPDB, dan kunjungan langsung',
    },
    placeholderText:
      '🗺️ Google Maps · SMPN 3 Kresek — Jl. Raya Kresek No. 15, Tangerang, Banten · Embed iframe Google Maps dapat ditambahkan di sini setelah data lokasi resmi tersedia',
    primaryAction: { label: 'Buka di Google Maps', href: 'https://maps.google.com', icon: '📍' },
    secondaryAction: { label: 'Petunjuk Arah', href: 'https://maps.google.com/dir', icon: '🧭' },
  },
  form: {
    eyebrow: 'FORM KONTAK',
    title: 'Kirim Pesan kepada Kami',
    intro:
      'Punya pertanyaan tentang sekolah, PPDB, atau ingin bekerja sama? Silakan isi form di samping dan pesan Anda akan langsung diteruskan ke WhatsApp atau Email sekolah kami.',
    noteIcon: '⏱️',
    noteText:
      'Respon biasanya dalam 1×24 jam pada hari dan jam kerja. Untuk keperluan mendesak, silakan hubungi kami langsung melalui telepon.',
    fields: {
      nama: { label: 'Nama Lengkap *', placeholder: 'Masukkan nama lengkap Anda', required: true, errorMessage: 'Nama lengkap wajib diisi' },
      email: { label: 'Email *', placeholder: 'nama@email.com', required: true, errorMessage: 'Email tidak valid' },
      telp: { label: 'Nomor Telepon *', placeholder: '08xx-xxxx-xxxx', required: true, errorMessage: 'Nomor telepon wajib diisi' },
      subjek: {
        label: 'Subjek *',
        placeholder: 'Pilih subjek pesan...',
        required: true,
        errorMessage: 'Subjek wajib dipilih',
        options: [
          'PPDB (Penerimaan Peserta Didik Baru)',
          'Informasi Akademik',
          'Kerjasama / Kemitraan',
          'Pengaduan',
          'Permohonan Kunjungan',
          'Lainnya',
        ],
      },
      pesan: { label: 'Pesan *', placeholder: 'Tuliskan pesan Anda di sini...', required: true, errorMessage: 'Pesan wajib diisi' },
    },
    agreement: {
      label: 'Saya menyetujui kebijakan privasi SMPN 3 Kresek dan memberikan izin penggunaan data untuk keperluan komunikasi.',
      required: true,
      errorMessage: 'Persetujuan kebijakan privasi diperlukan',
    },
    waButtonLabel: '💬 Kirim via WhatsApp',
    emailButtonLabel: '✉️ Kirim via Email',
    helperText: '* wajib diisi · Form ini akan membuka WhatsApp atau Email Anda dengan pesan yang telah terisi otomatis',
    // TODO: replace with real WA number (international format, no plus)
    waNumber: '6221592212345',
    // TODO: replace with real email
    emailTo: 'info@smpn3kresek.sch.id',
    waMessageTemplate:
      'Halo SMPN 3 Kresek,\n\n*Nama:* {{nama}}\n*Email:* {{email}}\n*Telepon:* {{telp}}\n*Subjek:* {{subjek}}\n\n*Pesan:*\n{{pesan}}\n\nTerima kasih.',
    emailSubjectTemplate: '[{{subjek}}] Pesan dari {{nama}}',
    emailBodyTemplate:
      'Nama: {{nama}}\nEmail: {{email}}\nTelepon: {{telp}}\n\nPesan:\n{{pesan}}',
  },
  faq: {
    meta: {
      eyebrow: 'FAQ',
      title: 'Pertanyaan yang Sering Diajukan',
      subtitle: 'Temukan jawaban cepat untuk pertanyaan umum seputar SMPN 3 Kresek',
    },
    searchPlaceholder: 'Cari pertanyaan...',
    filterLabels: { all: 'Semua', ppdb: 'PPDB', akademik: 'Akademik', administrasi: 'Administrasi', lainnya: 'Lainnya' },
    items: [
      { id: 'q1', category: 'ppdb', question: 'Bagaimana cara mendaftar di SMPN 3 Kresek?', answer: 'Pendaftaran dilakukan melalui sistem PPDB Online Kabupaten Tangerang yang dibuka setiap awal tahun ajaran baru (sekitar bulan Juni–Juli). Calon siswa wajib memiliki ijazah SD/MI atau surat keterangan lulus, akta kelahiran, dan kartu keluarga. Hubungi tata usaha sekolah untuk informasi lengkap.' },
      { id: 'q2', category: 'ppdb', question: 'Berapa biaya pendidikan di SMPN 3 Kresek?', answer: 'SMPN 3 Kresek adalah sekolah negeri yang tunduk pada peraturan pemerintah. Biaya pendidikan dasar tidak dipungut (gratis) sesuai program Wajib Belajar 9 Tahun dan Program Indonesia Pintar (PIP). Beberapa kegiatan tertentu mungkin memerlukan kontribusi sukarela yang transparan dan sesuai musyawarah komite sekolah.' },
      { id: 'q3', category: 'ppdb', question: 'Apa saja syarat penerimaan siswa baru (PPDB)?', answer: 'Syarat PPDB meliputi: (1) Ijazah atau Surat Keterangan Lulus SD/MI, (2) Akta kelahiran asli, (3) Kartu Keluarga, (4) Foto terbaru 3×4 (2 lembar), (5) Sertifikat prestasi (jika ada, untuk jalur prestasi). Usia maksimal 15 tahun pada tanggal 1 Juli tahun pendaftaran. Persyaratan dapat berubah sesuai kebijakan dinas pendidikan setempat.' },
      { id: 'q4', category: 'akademik', question: 'Apakah ada program beasiswa untuk siswa berprestasi atau kurang mampu?', answer: 'Ya, SMPN 3 Kresek memfasilitasi beberapa program bantuan: (1) Program Indonesia Pintar (PIP) untuk siswa dari keluarga kurang mampu, (2) Beasiswa prestasi dari Dinas Pendidikan Kabupaten Tangerang, (3) Bantuan dari Komite Sekolah untuk siswa yang membutuhkan. Hubungi wali kelas atau BK untuk informasi pengajuan.' },
      { id: 'q5', category: 'administrasi', question: 'Bagaimana cara meminta surat keterangan atau legalisir ijazah?', answer: 'Pengajuan surat keterangan dan legalisir dapat dilakukan langsung ke Tata Usaha sekolah pada jam kerja (Senin–Jumat, 07.00–14.00 WIB). Bawa dokumen asli dan fotokopi yang diperlukan. Proses biasanya membutuhkan 1–3 hari kerja. Untuk keperluan mendesak, hubungi TU terlebih dahulu melalui telepon.' },
      { id: 'q6', category: 'akademik', question: 'Bagaimana cara berkonsultasi dengan guru BK atau wali kelas?', answer: 'Orang tua/wali dapat menghubungi guru BK atau wali kelas melalui: (1) Langsung ke sekolah pada jam kerja, (2) Melalui buku penghubung siswa, (3) Menghubungi nomor sekolah dan meminta disambungkan, (4) Melalui aplikasi komunikasi sekolah (jika tersedia). Konsultasi dapat diagendakan sebelumnya untuk memastikan ketersediaan guru.' },
      { id: 'q7', category: 'lainnya', question: 'Bagaimana prosedur kunjungan atau observasi ke sekolah?', answer: 'Kunjungan ke SMPN 3 Kresek sangat kami sambut. Hubungi kami terlebih dahulu melalui telepon atau email untuk menjadwalkan kunjungan. Kunjungan dilayani pada hari dan jam kerja. Tamu wajib melapor ke pos keamanan dan mengisi buku tamu. Kunjungan dalam rangka penelitian atau studi banding memerlukan surat resmi dari lembaga.' },
      { id: 'q8', category: 'lainnya', question: 'Bagaimana cara mengetahui jadwal kegiatan dan agenda sekolah?', answer: 'Informasi agenda sekolah dapat diikuti melalui: (1) Website resmi ini di bagian Akademik → Kalender Pendidikan, (2) Media sosial resmi sekolah (Instagram, Facebook), (3) Papan pengumuman sekolah, (4) Grup WhatsApp wali murid yang dikelola wali kelas, (5) Buku agenda siswa yang dibagikan setiap awal tahun ajaran.' },
    ],
    noResultsText: 'Tidak ada pertanyaan yang cocok.',
    ctaText: 'Tidak menemukan jawaban yang Anda cari? Hubungi kami →',
    ctaHref: '#form',
  },
  ctaFinal: {
    title: 'Siap untuk Bergabung?',
    subtitle: 'Hubungi kami sekarang untuk informasi PPDB, kunjungan sekolah, atau pertanyaan lainnya.',
    primary: { label: '💬 Chat WhatsApp Sekarang', href: 'https://wa.me/6221592212345?text=Halo%20SMPN%203%20Kresek%2C%20saya%20ingin%20bertanya%20tentang%20sekolah.' },
    secondary: { label: '📞 Telepon Kami', href: 'tel:+62215922-1234' },
  },
};

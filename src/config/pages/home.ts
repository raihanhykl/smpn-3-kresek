import type { HomePageConfig } from '../types';

export const homePageConfig: HomePageConfig = {
  hero: {
    badge: 'Terakreditasi — Sekolah Unggul di Kresek',
    titleLine1: 'Selamat Datang di',
    titleLine2: 'SMPN 3 Kresek',
    subtitle:
      'Membentuk Generasi Cerdas, Berkarakter, dan Berprestasi di Kabupaten Tangerang',
    description:
      'Kami berkomitmen menghadirkan pendidikan berkualitas yang memadukan ilmu pengetahuan, teknologi, dan pembentukan karakter Profil Pelajar Pancasila.',
    primary: { label: 'Jelajahi Sekolah Kami', href: '#stats', icon: '→' },
    secondary: { label: 'Hubungi Kami', href: '/kontak' },
    scrollLabel: 'Gulir ke bawah',
  },
  stats: {
    meta: {
      eyebrow: 'SMPN 3 Kresek dalam Angka',
      title: 'Komitmen Kami untuk Pendidikan Berkualitas',
      subtitle:
        'Pencapaian nyata yang terus kami banggakan dan tingkatkan setiap tahunnya',
    },
    cards: [
      // TODO: replace with real data
      { id: 'siswa', icon: '📚', iconBg: '#DBEAFE', value: '500', numeric: 500, suffix: '+', label: 'Siswa Aktif' },
      { id: 'guru', icon: '👨‍🏫', iconBg: '#D1FAE5', value: '30', numeric: 30, suffix: '+', label: 'Tenaga Pendidik' },
      { id: 'prestasi', icon: '🏆', iconBg: '#FEF9C3', value: '50', numeric: 50, suffix: '+', label: 'Prestasi Diraih' },
      { id: 'akreditasi', icon: '🎓', iconBg: '#F3E8FF', value: 'A', label: 'Akreditasi BAN-S/M' },
    ],
  },
  sambutan: {
    eyebrow: 'SAMBUTAN',
    title: 'Sambutan Kepala Sekolah',
    paragraphs: [
      "Assalamu'alaikum Warahmatullahi Wabarakatuh. Selamat datang di website resmi SMPN 3 Kresek. Kehadiran website ini merupakan salah satu wujud komitmen kami dalam meningkatkan akses informasi dan transparansi kepada seluruh pemangku kepentingan sekolah.",
      'SMPN 3 Kresek hadir sebagai lembaga pendidikan yang berkomitmen mencetak generasi penerus bangsa yang cerdas, berkarakter mulia, dan siap menghadapi tantangan abad ke-21. Dengan Kurikulum Merdeka yang kami terapkan, kami mendorong setiap siswa untuk berkembang sesuai bakat dan minat masing-masing.',
      'Kami terus berupaya meningkatkan kualitas layanan pendidikan demi terwujudnya visi sekolah yang kami cita-citakan bersama. Semoga website ini bermanfaat dan menjadi jembatan informasi yang efektif bagi seluruh keluarga besar SMPN 3 Kresek.',
    ],
    // TODO: replace with real Kepsek name
    signatureName: 'Drs. H. Ahmad Suherman, M.Pd.',
    signatureTitle: 'Kepala SMPN 3 Kresek',
    photoPlaceholderText: 'Foto Kepala Sekolah · ~400 × 500 px',
    photoEmoji: '👤',
  },
  about: {
    eyebrow: 'TENTANG KAMI',
    titleLines: ['Mengenal', 'SMPN 3 Kresek'],
    paragraphs: [
      'SMPN 3 Kresek adalah Sekolah Menengah Pertama Negeri yang berdiri dengan komitmen kuat dalam menyelenggarakan pendidikan berkualitas di Kecamatan Kresek, Kabupaten Tangerang, Banten. Kami telah mendedikasikan diri selama bertahun-tahun dalam membentuk generasi yang unggul dan berkarakter.',
      'Dengan menerapkan Kurikulum Merdeka, kami memberikan ruang seluas-luasnya bagi siswa untuk berkembang sesuai potensi yang mereka miliki, didampingi oleh tenaga pendidik profesional dan bersertifikasi.',
    ],
    checks: [
      'Kurikulum Merdeka yang adaptif dan inovatif',
      'Tenaga pendidik profesional dan bersertifikasi',
      'Fasilitas belajar lengkap dan modern',
      'Lingkungan kondusif, aman, dan inklusif',
    ],
    cta: { label: 'Selengkapnya tentang Kami', href: '/profil', icon: '→' },
    badge: '✨ Lebih dari 20 Tahun Berkarya',
    photoMainText: 'Kegiatan Belajar Mengajar · ~480 × 360 px',
    photoSubText: 'Kegiatan Siswa · ~220 × 200 px',
  },
  programs: {
    meta: {
      eyebrow: 'PROGRAM KAMI',
      title: 'Program Unggulan untuk Masa Depan',
      subtitle:
        'Pendidikan holistik yang menyeimbangkan akademik, karakter, dan keterampilan abad ke-21',
    },
    cards: [
      {
        id: 'akademik',
        icon: '🎓',
        iconBg: '#DBEAFE',
        title: 'Akademik Unggul',
        description:
          'Pembelajaran berbasis Kurikulum Merdeka dengan pendekatan student-centered yang mendorong kemandirian dan kreativitas berpikir siswa.',
        href: '/akademik',
        linkText: 'Pelajari Lebih Lanjut',
      },
      {
        id: 'ekskul',
        icon: '🏆',
        iconBg: '#D1FAE5',
        title: 'Ekstrakurikuler Beragam',
        description:
          'Lebih dari 15 kegiatan ekstrakurikuler pilihan untuk mengembangkan minat, bakat, dan soft skill siswa di berbagai bidang.',
        href: '/fasilitas',
        linkText: 'Pelajari Lebih Lanjut',
      },
      {
        id: 'karakter',
        icon: '💛',
        iconBg: '#FEF9C3',
        title: 'Karakter & Religi',
        description:
          'Pembentukan karakter Profil Pelajar Pancasila dan nilai-nilai keagamaan yang terintegrasi dalam setiap aspek kehidupan sekolah.',
        href: '/profil',
        linkText: 'Pelajari Lebih Lanjut',
      },
    ],
  },
  gallery: {
    meta: {
      eyebrow: 'GALERI',
      title: 'Momen di SMPN 3 Kresek',
      subtitle: 'Aktivitas dan kebersamaan keluarga besar sekolah yang penuh semangat',
    },
    items: [
      {id: 'g1', caption: 'Upacara Bendera Hari Senin', photo: { kind: 'gradient', from: '#1565C0', to: '#1E88E5', emoji: '🚩' }, span: 'wide' },
      {id: 'g2', caption: 'Praktikum Laboratorium IPA', photo: { kind: 'gradient', from: '#D1FAE5', to: '#6EE7B7', emoji: '🔬' } },
      {id: 'g3', caption: 'Pentas Seni Budaya', photo: { kind: 'gradient', from: '#F3E8FF', to: '#C4B5FD', emoji: '🎭' } },
      {id: 'g4', caption: 'Kegiatan Pramuka', photo: { kind: 'gradient', from: '#FEF9C3', to: '#FDE68A', emoji: '⛺' }, span: 'wide' },
      {id: 'g5', caption: 'Sudut Baca Perpustakaan', photo: { kind: 'gradient', from: '#FEE2E2', to: '#FCA5A5', emoji: '📚' } },
      {id: 'g6', caption: 'Kelas Teknologi Informasi', photo: { kind: 'gradient', from: '#DBEAFE', to: '#93C5FD', emoji: '💻' } },
      {id: 'g7', caption: 'Pelepasan Siswa Kelas 9', photo: { kind: 'gradient', from: '#FFF7ED', to: '#FED7AA', emoji: '🎓' } },
      {id: 'g8', caption: 'Meraih Prestasi di Olimpiade', photo: { kind: 'gradient', from: '#ECFDF5', to: '#6EE7B7', emoji: '🏆' } },
    ],
    ctaLabel: 'Lihat Semua Galeri',
    ctaHref: '/fasilitas',
  },
  achievements: {
    meta: {
      eyebrow: 'PRESTASI',
      title: 'Prestasi Membanggakan',
      subtitle: 'Capaian siswa-siswi kami di berbagai bidang kompetisi',
    },
    items: [
      // TODO: replace with real achievements
      { id: 'a1', year: 2024, title: 'Juara 2 Olimpiade Matematika', recipient: 'Ananda Putri Ramadhani', organizer: 'Kemendikbudristek', level: 'nasional', photo: { kind: 'gradient', from: '#E0F2FE', to: '#FFFFFF', emoji: '🏆' } },
      { id: 'a2', year: 2024, title: 'Juara 1 Lomba Futsal SMP Banten', recipient: 'Tim Futsal SMPN 3 Kresek', organizer: 'KONI Banten', level: 'provinsi', photo: { kind: 'gradient', from: '#E0F2FE', to: '#FFFFFF', emoji: '🥇' } },
      { id: 'a3', year: 2024, title: 'Juara 1 Lomba Karya Ilmiah Remaja', recipient: 'Tim KIR', organizer: 'Dinas Pendidikan Tangerang', level: 'kabupaten', photo: { kind: 'gradient', from: '#E0F2FE', to: '#FFFFFF', emoji: '🎨' } },
      { id: 'a4', year: 2023, title: 'Juara 2 Lomba Baca Puisi Banten', recipient: 'Siti Nur Aisyah', organizer: 'Dinas Kebudayaan Banten', level: 'provinsi', photo: { kind: 'gradient', from: '#E0F2FE', to: '#FFFFFF', emoji: '📖' } },
      { id: 'a5', year: 2023, title: 'Juara 1 Paduan Suara Tingkat SMP', recipient: 'Paduan Suara SMPN 3 Kresek', organizer: 'Pemkab Tangerang', level: 'kabupaten', photo: { kind: 'gradient', from: '#E0F2FE', to: '#FFFFFF', emoji: '🎤' } },
    ],
    ctaLabel: 'Lihat Semua Prestasi',
    ctaHref: '/profil',
  },
  lokasi: {
    meta: {
      eyebrow: 'LOKASI',
      title: 'Temukan Kami',
      subtitle: 'Kunjungi sekolah kami dan rasakan sendiri suasana belajar yang kondusif',
    },
    panelTitle: 'Informasi Kontak',
    panelDescription: 'Kami siap menerima kunjungan dan melayani pertanyaan Anda',
    cards: [
      {
        kind: 'address',
        icon: '📍',
        label: 'Alamat',
        value: 'Jl. Raya Kresek No. 15',
        sub: 'Kresek, Tangerang, Banten 15620',
      },
      {
        kind: 'phone',
        icon: '📞',
        label: 'Telepon',
        value: '(021) 5922-1234',
        sub: 'Jam kerja: Senin–Jumat, 07.00–15.00',
        href: 'tel:+62215922-1234',
      },
      {
        kind: 'email',
        icon: '✉️',
        label: 'Email',
        value: 'info@smpn3kresek.sch.id',
        sub: 'Respon dalam 1×24 jam kerja',
        href: 'mailto:info@smpn3kresek.sch.id',
      },
      {
        kind: 'hours',
        icon: '🕐',
        label: 'Jam Operasional',
        value: 'Senin – Jumat, 07.00 – 15.00',
        sub: 'Tutup pada hari Sabtu, Minggu, dan libur nasional',
      },
    ],
    primary: { label: 'Petunjuk Arah', href: 'https://maps.google.com/dir', icon: '📍' },
    secondary: { label: 'Salin Alamat', href: '#', icon: '⎘' },
    copyText: 'Jl. Raya Kresek No. 15, Kresek, Tangerang, Banten 15620',
  },
  ctaFinal: {
    title: 'Bergabunglah dengan Keluarga Besar SMPN 3 Kresek',
    titleLines: ['Bergabunglah dengan Keluarga Besar', 'SMPN 3 Kresek'],
    subtitle:
      'Wujudkan masa depan cemerlang bersama kami. Hubungi sekolah untuk informasi sekolah dan kunjungan lebih lanjut.',
    primary: { label: 'Hubungi Kami Sekarang', href: '/kontak' },
    secondary: { label: 'Kunjungi Sekolah', href: '/kontak' },
  },
};

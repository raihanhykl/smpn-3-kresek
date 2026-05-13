import type { ProfilePageConfig } from '../types';

export const profilPageConfig: ProfilePageConfig = {
  pageHeader: {
    breadcrumb: [
      { label: 'Beranda', href: '/' },
      { label: 'Profil Sekolah' },
    ],
    title: 'Profil SMPN 3 Kresek',
    subtitle: 'Mengenal lebih dekat sejarah, visi, misi, dan keluarga besar kami',
  },
  sejarah: {
    eyebrow: 'SEJARAH',
    title: 'Perjalanan SMPN 3 Kresek',
    paragraphs: [
      'SMPN 3 Kresek berdiri dengan tekad kuat untuk menghadirkan layanan pendidikan menengah pertama yang berkualitas bagi masyarakat Kecamatan Kresek dan sekitarnya. Sejak pertama kali membuka pintunya, sekolah ini telah menjadi tumpuan harapan ribuan keluarga di Kabupaten Tangerang.',
      'Dalam perjalanannya, SMPN 3 Kresek terus berbenah dan berkembang. Berbagai program inovatif dihadirkan untuk mengikuti perkembangan zaman, sementara nilai-nilai luhur karakter bangsa tetap dijaga dengan konsisten sebagai fondasi pendidikan.',
      'Kini, SMPN 3 Kresek hadir sebagai sekolah modern yang tidak hanya unggul secara akademik, namun juga membentuk lulusan yang berkarakter, mandiri, dan siap menghadapi tantangan global dengan bekal iman dan ilmu yang kuat.',
    ],
    photoPlaceholderText: 'Foto Gedung Sekolah atau Dokumentasi Bersejarah · ~480 × 420 px',
    photoEmoji: '🏫',
    timeline: [
      { id: 't1', marker: 'Tahun Pendirian', text: 'SMPN 3 Kresek resmi berdiri dan mulai menerima siswa pertamanya dari wilayah Kecamatan Kresek dan sekitarnya.' },
      { id: 't2', marker: 'Pengembangan Fasilitas', text: 'Pembangunan gedung baru, laboratorium IPA, laboratorium komputer, dan perpustakaan untuk meningkatkan kualitas pembelajaran.' },
      { id: 't3', marker: 'Pencapaian Akreditasi', text: 'Meraih status akreditasi dari Badan Akreditasi Nasional Sekolah/Madrasah (BAN-S/M) sebagai pengakuan kualitas layanan pendidikan.' },
      { id: 't4', marker: 'Era Digital & Kurikulum Merdeka', text: 'Transformasi digital dan implementasi Kurikulum Merdeka untuk menghadirkan pendidikan yang adaptif, inovatif, dan berpusat pada siswa.' },
    ],
  },
  visiMisi: {
    meta: {
      eyebrow: 'VISI & MISI',
      title: 'Visi & Misi Sekolah',
      subtitle: 'Komitmen kami dalam membentuk generasi penerus bangsa yang unggul dan berkarakter',
    },
    visi: {
      icon: '🎯',
      label: 'VISI',
      statement:
        '"Terwujudnya Insan yang Beriman, Berilmu, Berkarakter, Berprestasi, dan Berwawasan Lingkungan"',
    },
    misi: {
      icon: '📋',
      label: 'MISI',
      items: [
        'Menyelenggarakan pembelajaran berkualitas berbasis Kurikulum Merdeka yang berpusat pada siswa',
        'Menumbuhkan keimanan dan ketaqwaan melalui pembiasaan nilai-nilai agama dalam kehidupan sekolah',
        'Mengembangkan potensi siswa melalui kegiatan akademik dan ekstrakurikuler yang beragam',
        'Membangun karakter Profil Pelajar Pancasila yang kuat dan berintegritas',
        'Meningkatkan kompetensi tenaga pendidik dan kependidikan secara berkelanjutan',
        'Mewujudkan lingkungan sekolah yang bersih, sehat, aman, dan kondusif untuk belajar',
      ],
    },
  },
  tujuan: {
    meta: {
      eyebrow: 'TUJUAN',
      title: 'Tujuan Pendidikan Kami',
      subtitle: 'Sasaran yang ingin kami capai demi generasi Indonesia yang lebih baik',
    },
    cards: [
      { id: 'o1', number: '01', title: 'Prestasi Akademik Optimal', description: 'Menghasilkan lulusan yang mencapai standar kompetensi nasional dengan nilai ujian yang memuaskan.' },
      { id: 'o2', number: '02', title: 'Karakter yang Kuat', description: 'Membentuk siswa yang memiliki akhlak mulia, disiplin, jujur, dan bertanggung jawab dalam kehidupan.' },
      { id: 'o3', number: '03', title: 'Kecakapan Abad 21', description: 'Membekali siswa dengan kemampuan berpikir kritis, kreatif, komunikasi, dan kolaborasi yang solid.' },
      { id: 'o4', number: '04', title: 'Literasi Digital', description: 'Menguasai teknologi informasi secara bijak dan produktif untuk mendukung proses belajar dan berkarya.' },
      { id: 'o5', number: '05', title: 'Kemandirian Belajar', description: 'Menumbuhkan semangat belajar sepanjang hayat dan kemampuan mengatur diri sendiri secara mandiri.' },
      { id: 'o6', number: '06', title: 'Wawasan Kebangsaan', description: 'Menanamkan cinta tanah air, semangat kebangsaan, dan kesadaran sebagai warga negara yang baik.' },
    ],
  },
  identitas: {
    meta: {
      eyebrow: 'IDENTITAS',
      title: 'Identitas Sekolah',
      subtitle: 'Data resmi dan informasi kelembagaan SMPN 3 Kresek',
    },
    rows: [
      { label: 'Nama Sekolah', value: 'SMP Negeri 3 Kresek' },
      // TODO: replace with real NPSN
      { label: 'NPSN', value: '20604XXX' },
      { label: 'Status', value: 'Negeri', badge: 'negeri' },
      { label: 'Akreditasi', value: 'Terakreditasi — BAN-S/M', badge: 'akreditasi' },
      { label: 'Alamat', value: 'Jl. Raya Kresek No. 15, Kresek' },
      { label: 'Kecamatan', value: 'Kresek' },
      { label: 'Kabupaten', value: 'Tangerang' },
      { label: 'Provinsi', value: 'Banten' },
      { label: 'Kode Pos', value: '15620' },
      { label: 'Email', value: 'info@smpn3kresek.sch.id' },
      { label: 'Website', value: 'www.smpn3kresek.sch.id' },
      // TODO: replace with real Kepsek
      { label: 'Kepala Sekolah', value: 'Drs. H. Ahmad Suherman, M.Pd.' },
      { label: 'Jumlah Rombel', value: '12 Rombongan Belajar' },
      { label: 'Kurikulum', value: 'Kurikulum Merdeka' },
    ],
  },
  struktur: {
    meta: {
      eyebrow: 'STRUKTUR ORGANISASI',
      title: 'Struktur Organisasi',
      subtitle: 'Hierarki kepemimpinan dan pengelolaan sekolah',
    },
    chart: {
      levels: [
        // TODO: confirm real names + titles
        { id: 'l0', boxes: [{ name: 'Drs. H. Ahmad Suherman, M.Pd.', title: 'Kepala Sekolah' }] },
        {
          id: 'l1',
          boxes: [
            { name: 'Wakasek Kurikulum', title: 'Bid. Akademik' },
            { name: 'Wakasek Kesiswaan', title: 'Bid. Siswa' },
            { name: 'Wakasek Sarpras', title: 'Bid. Fasilitas' },
            { name: 'Wakasek Humas', title: 'Bid. Hubungan Masy.' },
          ],
        },
        {
          id: 'l2',
          boxes: [
            { name: 'Tata Usaha', title: 'Administrasi' },
            { name: 'Bendahara', title: 'Keuangan' },
            { name: 'Wali Kelas', title: 'Kelas 7, 8, 9' },
            { name: 'Guru Mapel', title: 'Mata Pelajaran' },
            { name: 'Pembina Ekskul', title: 'Ekstrakurikuler' },
          ],
        },
      ],
      studentNote: '👥 Siswa SMPN 3 Kresek — 500+ Siswa Aktif',
    },
  },
  guru: {
    meta: {
      eyebrow: 'TENAGA PENDIDIK',
      title: 'Guru & Staf',
      subtitle: 'Tim profesional yang mendedikasikan diri untuk kemajuan pendidikan',
    },
    filterLabels: {
      all: 'Semua',
      pimpinan: 'Pimpinan',
      guru: 'Guru Mata Pelajaran',
      tu: 'Tata Usaha',
    },
    // TODO: replace with real teacher data
    teachers: [
      { id: 'p1', name: 'Drs. H. Ahmad Suherman', position: 'Kepala Sekolah', badge: 'M.Pd.', category: 'pimpinan', photo: { kind: 'gradient', from: '#DBEAFE', to: '#93C5FD', emoji: '👨‍💼' } },
      { id: 'p2', name: 'Hj. Siti Fatimah, S.Pd.', position: 'Wakasek Kurikulum', badge: 'S.Pd.', category: 'pimpinan', photo: { kind: 'gradient', from: '#D1FAE5', to: '#6EE7B7', emoji: '👩‍💼' } },
      { id: 'p3', name: 'Bambang Sutrisno, S.Pd.', position: 'Wakasek Kesiswaan', badge: 'S.Pd.', category: 'pimpinan', photo: { kind: 'gradient', from: '#FEF9C3', to: '#FDE68A', emoji: '👨‍💼' } },
      { id: 'g1', name: 'Nurul Hidayah, S.Pd.', position: 'Guru Matematika', badge: 'S.Pd.', category: 'guru', photo: { kind: 'gradient', from: '#F3E8FF', to: '#C4B5FD', emoji: '👩‍🏫' } },
      { id: 'g2', name: 'Ahmad Fauzi, M.Pd.', position: 'Guru Bahasa Indonesia', badge: 'M.Pd.', category: 'guru', photo: { kind: 'gradient', from: '#FEE2E2', to: '#FCA5A5', emoji: '👨‍🏫' } },
      { id: 'g3', name: 'Dewi Rahmawati, S.Pd.', position: 'Guru Bahasa Inggris', badge: 'S.Pd.', category: 'guru', photo: { kind: 'gradient', from: '#ECFDF5', to: '#6EE7B7', emoji: '👩‍🏫' } },
      { id: 'g4', name: 'Drs. Suryadi', position: 'Guru IPA', badge: 'S.Pd.', category: 'guru', photo: { kind: 'gradient', from: '#EFF6FF', to: '#93C5FD', emoji: '👨‍🏫' } },
      { id: 'g5', name: 'Rina Susanti, S.Pd.', position: 'Guru IPS', badge: 'S.Pd.', category: 'guru', photo: { kind: 'gradient', from: '#FFF7ED', to: '#FED7AA', emoji: '👩‍🏫' } },
      { id: 'g6', name: 'Usman Hakim, S.Pd.', position: 'Guru PJOK', badge: 'S.Pd.', category: 'guru', photo: { kind: 'gradient', from: '#F0FDF4', to: '#86EFAC', emoji: '👨‍🏫' } },
      { id: 'g7', name: 'Lilis Suryani, S.Pd.I.', position: 'Guru Pendidikan Agama', badge: 'S.Pd.I.', category: 'guru', photo: { kind: 'gradient', from: '#FDF4FF', to: '#E879F9', emoji: '👩‍🏫' } },
      { id: 't1', name: 'Marlina, S.E.', position: 'Kepala Tata Usaha', badge: 'S.E.', category: 'tu', photo: { kind: 'gradient', from: '#F8FAFC', to: '#CBD5E1', emoji: '👩‍💻' } },
      { id: 't2', name: 'Irfan Maulana', position: 'Staf Administrasi', badge: 'D3', category: 'tu', photo: { kind: 'gradient', from: '#F0FDF4', to: '#BBF7D0', emoji: '👨‍💻' } },
    ],
  },
  prestasi: {
    meta: {
      eyebrow: 'PRESTASI',
      title: 'Prestasi & Penghargaan',
      subtitle: 'Capaian membanggakan dari siswa-siswi dan sekolah kami',
    },
    items: [
      { id: 'fa1', year: 2024, title: 'Juara 2 Olimpiade Matematika', recipient: 'Ananda Putri R.', organizer: 'Kemendikbudristek', level: 'nasional', icon: '🏆' },
      { id: 'fa2', year: 2024, title: 'Juara 1 Futsal SMP Se-Banten', recipient: 'Tim Futsal', organizer: 'KONI Banten', level: 'provinsi', icon: '🥇' },
      { id: 'fa3', year: 2024, title: 'Juara 1 Karya Ilmiah Remaja', recipient: 'Tim KIR', organizer: 'Dinas Pendidikan Tangerang', level: 'kabupaten', icon: '🎖️' },
      { id: 'fa4', year: 2023, title: 'Juara 2 Baca Puisi Banten', recipient: 'Siti Nur A.', organizer: 'Dinas Kebudayaan Banten', level: 'provinsi', icon: '📖' },
      { id: 'fa5', year: 2023, title: 'Juara 1 Paduan Suara', recipient: 'Paduan Suara SMPN 3 Kresek', organizer: 'Pemkab Tangerang', level: 'kabupaten', icon: '🎤' },
      { id: 'fa6', year: 2023, title: 'Juara 2 Bulu Tangkis Putri', recipient: 'Anisa Maharani', organizer: 'KONI Tangerang', level: 'kabupaten', icon: '🏸' },
    ],
  },
  ctaFinal: {
    title: 'Bergabunglah dengan Keluarga Besar SMPN 3 Kresek',
    titleLines: ['Bergabunglah dengan Keluarga Besar', 'SMPN 3 Kresek'],
    subtitle: 'Daftarkan putra-putri Anda dan wujudkan masa depan yang cerah bersama kami.',
    primary: { label: 'Hubungi Kami Sekarang', href: '/kontak' },
    secondary: { label: 'Lihat Program Akademik', href: '/akademik' },
  },
};

import type { AcademicPageConfig, SubjectCard } from '../types';

const kelas7Wajib: SubjectCard[] = [
  { id: 'k7-pai', name: 'Pendidikan Agama & Budi Pekerti', icon: '🕌', iconBg: '#FEE2E2', hours: '3 JP/minggu' },
  { id: 'k7-ppkn', name: 'PPKn', icon: '🇮🇩', iconBg: '#DBEAFE', hours: '2 JP/minggu' },
  { id: 'k7-bind', name: 'Bahasa Indonesia', icon: '📖', iconBg: '#D1FAE5', hours: '6 JP/minggu' },
  { id: 'k7-mtk', name: 'Matematika', icon: '🔢', iconBg: '#FEF9C3', hours: '5 JP/minggu' },
  { id: 'k7-ipa', name: 'Ilmu Pengetahuan Alam', icon: '🔬', iconBg: '#F3E8FF', hours: '5 JP/minggu' },
  { id: 'k7-ips', name: 'Ilmu Pengetahuan Sosial', icon: '🌍', iconBg: '#FEE2E2', hours: '4 JP/minggu' },
  { id: 'k7-bing', name: 'Bahasa Inggris', icon: '🇬🇧', iconBg: '#ECFDF5', hours: '4 JP/minggu' },
];

export const akademikPageConfig: AcademicPageConfig = {
  pageHeader: {
    breadcrumb: [
      { label: 'Beranda', href: '/' },
      { label: 'Akademik' },
    ],
    title: 'Akademik',
    subtitle: 'Kurikulum berkualitas dan kegiatan pembelajaran yang inovatif di SMPN 3 Kresek',
  },
  kurikulum: {
    eyebrow: 'KURIKULUM',
    title: 'Kurikulum yang Kami Terapkan',
    paragraphs: [
      'SMPN 3 Kresek menerapkan Kurikulum Merdeka — kurikulum nasional yang dirancang untuk memberikan fleksibilitas kepada sekolah dan guru dalam mengembangkan pembelajaran yang sesuai dengan kebutuhan dan potensi siswa.',
      'Dengan pendekatan pembelajaran yang berpusat pada siswa (student-centered), setiap anak didorong untuk menjadi pelajar yang aktif, mandiri, dan mampu berpikir kritis. Guru berperan sebagai fasilitator yang membimbing proses penemuan pengetahuan.',
      'Implementasi Kurikulum Merdeka di SMPN 3 Kresek juga mencakup Proyek Penguatan Profil Pelajar Pancasila (P5) yang dirancang untuk membangun karakter dan kompetensi siswa secara holistik.',
    ],
    chips: ['Berbasis Kompetensi', 'Pembelajaran Aktif', 'Profil Pelajar Pancasila', 'Proyek P5'],
    floatStat: { value: '100%', label: 'Kurikulum Merdeka' },
    photoEmoji: '📚',
    photoPlaceholderText: 'Foto Kegiatan Pembelajaran · ~400 × 360 px',
  },
  mapel: {
    meta: {
      eyebrow: 'PEMBELAJARAN',
      title: 'Mata Pelajaran',
      subtitle: 'Kurikulum komprehensif untuk perkembangan holistik siswa di setiap jenjang kelas',
    },
    tabs: [
      {
        id: 'kelas7',
        label: 'Kelas 7',
        groups: [
          { id: 'k7-a', title: 'Kelompok A — Mata Pelajaran Wajib', subjects: kelas7Wajib },
          {
            id: 'k7-b',
            title: 'Kelompok B — Pengembangan Diri',
            subjects: [
              { id: 'k7-seni', name: 'Seni Budaya', icon: '🎨', iconBg: '#FFF7ED', hours: '3 JP/minggu' },
              { id: 'k7-pjok', name: 'PJOK', icon: '⚽', iconBg: '#F0FDF4', hours: '3 JP/minggu' },
              { id: 'k7-info', name: 'Informatika', icon: '💻', iconBg: '#DBEAFE', hours: '2 JP/minggu' },
              { id: 'k7-bda', name: 'Bahasa Daerah', icon: '🗣️', iconBg: '#F3E8FF', hours: '2 JP/minggu' },
            ],
          },
        ],
      },
      {
        id: 'kelas8',
        label: 'Kelas 8',
        groups: [
          { id: 'k8-a', title: 'Kelompok A — Mata Pelajaran Wajib', subjects: kelas7Wajib.map((s) => ({ ...s, id: s.id.replace('k7', 'k8') })) },
          {
            id: 'k8-b',
            title: 'Kelompok B + Prakarya/Mulok',
            subjects: [
              { id: 'k8-seni', name: 'Seni Budaya', icon: '🎨', iconBg: '#FFF7ED', hours: '3 JP/minggu' },
              { id: 'k8-pjok', name: 'PJOK', icon: '⚽', iconBg: '#F0FDF4', hours: '3 JP/minggu' },
              { id: 'k8-prakarya', name: 'Prakarya', icon: '🛠️', iconBg: '#DBEAFE', hours: '2 JP/minggu' },
              { id: 'k8-bda', name: 'Bahasa Daerah', icon: '🗣️', iconBg: '#F3E8FF', hours: '2 JP/minggu' },
              { id: 'k8-bk', name: 'Bimbingan Konseling', icon: '🧭', iconBg: '#ECFDF5', hours: '1 JP/minggu' },
            ],
          },
        ],
      },
      {
        id: 'kelas9',
        label: 'Kelas 9',
        groups: [
          { id: 'k9-a', title: 'Kelompok A — Persiapan Ujian Sekolah', subjects: kelas7Wajib.map((s) => ({ ...s, id: s.id.replace('k7', 'k9') })) },
          {
            id: 'k9-b',
            title: 'Kelompok B + Program Intensif',
            subjects: [
              { id: 'k9-seni', name: 'Seni Budaya', icon: '🎨', iconBg: '#FFF7ED', hours: '2 JP/minggu' },
              { id: 'k9-pjok', name: 'PJOK', icon: '⚽', iconBg: '#F0FDF4', hours: '2 JP/minggu' },
              { id: 'k9-bbi', name: 'Bimbingan Belajar Intensif', icon: '📝', iconBg: '#DBEAFE', hours: '4 JP/minggu' },
              { id: 'k9-bk', name: 'Bimbingan Konseling', icon: '🧭', iconBg: '#FEF9C3', hours: '1 JP/minggu' },
            ],
          },
        ],
      },
    ],
  },
  jadwal: {
    meta: {
      eyebrow: 'JADWAL',
      title: 'Jadwal Kegiatan Belajar',
      subtitle: 'Struktur waktu pembelajaran harian yang teratur dan kondusif',
    },
    cards: [
      {
        id: 'j1',
        icon: '🌅',
        bgClass: 'primary',
        title: 'Hari & Jam Sekolah',
        items: [
          'Senin – Jumat (hari efektif)',
          'Masuk pukul 07.00 WIB',
          'Pulang pukul 13.30 – 14.00 WIB',
          'Upacara Bendera setiap Senin pagi',
          "Apel pagi / tadarus Al-Qur'an harian",
        ],
      },
      {
        id: 'j2',
        icon: '☕',
        bgClass: 'secondary',
        title: 'Waktu Istirahat',
        items: [
          'Istirahat 1: 09.30 – 10.00 WIB',
          'Istirahat 2: 12.00 – 12.30 WIB',
          'Shalat Dzuhur berjamaah (Istirahat 2)',
          'Literasi pagi 15 menit sebelum KBM',
        ],
      },
    ],
    note: '* Jadwal pelajaran lengkap per kelas tersedia melalui wali kelas masing-masing',
  },
  metode: {
    meta: {
      eyebrow: 'METODE',
      title: 'Pendekatan Pembelajaran Kami',
      subtitle: 'Metode modern untuk pengalaman belajar yang lebih bermakna dan efektif',
    },
    cards: [
      { id: 'm1', icon: '🎯', title: 'Pembelajaran Aktif', description: 'Siswa sebagai pusat pembelajaran melalui diskusi, eksplorasi, dan pengalaman langsung yang bermakna.' },
      { id: 'm2', icon: '📋', title: 'Project-Based Learning', description: 'Pembelajaran melalui proyek nyata yang relevan dengan kehidupan sehari-hari siswa dan masyarakat.' },
      { id: 'm3', icon: '💻', title: 'Pembelajaran Digital', description: 'Pemanfaatan teknologi dan platform digital untuk memperkaya pengalaman belajar siswa.' },
      { id: 'm4', icon: '💛', title: 'Pendidikan Karakter', description: 'Pengembangan Profil Pelajar Pancasila yang terintegrasi dalam setiap mata pelajaran dan kegiatan sekolah.' },
    ],
  },
  penilaian: {
    meta: {
      eyebrow: 'PENILAIAN',
      title: 'Sistem Penilaian',
      subtitle: 'Asesmen yang komprehensif untuk memantau perkembangan siswa secara holistik',
    },
    intro:
      'Dalam Kurikulum Merdeka, penilaian dirancang untuk mendukung proses belajar, bukan sekadar mengukur hasil akhir. Sistem asesmen berfokus pada pengembangan kompetensi dan pemahaman mendalam siswa.',
    cards: [
      { id: 'p1', icon: '📝', title: 'Asesmen Formatif', description: 'Penilaian berkelanjutan yang dilakukan selama proses pembelajaran untuk memantau perkembangan dan memberikan umpan balik segera.', badge: 'Setiap Pembelajaran' },
      { id: 'p2', icon: '📊', title: 'Asesmen Sumatif', description: 'Penilaian di akhir unit atau semester untuk mengukur pencapaian kompetensi siswa secara menyeluruh.', badge: 'Tengah & Akhir Semester' },
      { id: 'p3', icon: '📃', title: 'Rapor Komprehensif', description: 'Laporan perkembangan akademik dan non-akademik yang menggambarkan capaian dan karakter siswa secara utuh.', badge: 'Setiap Semester' },
    ],
  },
  kalender: {
    meta: {
      eyebrow: 'KALENDER',
      title: 'Kalender Pendidikan',
      subtitle: 'Tahun Ajaran 2025/2026',
    },
    events: [
      { id: 'c1', date: 'Juli 2025', title: 'Awal Tahun Ajaran 2025/2026', type: 'kbm', typeLabel: 'KBM', sub: 'MPLS (Masa Pengenalan Lingkungan Sekolah) untuk kelas 7' },
      { id: 'c2', date: 'Agustus 2025', title: 'Peringatan HUT RI ke-80', type: 'acara', typeLabel: 'Acara', sub: 'Upacara bendera dan berbagai kegiatan kemerdekaan' },
      { id: 'c3', date: 'Sept–Okt 2025', title: 'Penilaian Tengah Semester Ganjil', type: 'ujian', typeLabel: 'Ujian', sub: 'PTS Semester Ganjil T.A. 2025/2026' },
      { id: 'c4', date: 'Nov–Des 2025', title: 'Penilaian Akhir Semester Ganjil', type: 'ujian', typeLabel: 'Ujian', sub: 'PAS Semester Ganjil dan pembagian rapor' },
      { id: 'c5', date: 'Des 2025', title: 'Libur Semester Ganjil', type: 'libur', typeLabel: 'Libur', sub: 'Libur akhir semester dan Natal/Tahun Baru' },
      { id: 'c6', date: 'Jan 2026', title: 'Awal Semester Genap', type: 'kbm', typeLabel: 'KBM', sub: 'Dimulainya kegiatan belajar mengajar semester genap' },
      { id: 'c7', date: 'Mar–Apr 2026', title: 'Ujian Sekolah Kelas 9', type: 'ujian', typeLabel: 'Ujian', sub: 'US dan Asesmen Sumatif Akhir Jenjang (ASAJ)' },
      { id: 'c8', date: 'Mei–Jun 2026', title: 'PAT & Pelepasan Kelas 9', type: 'acara', typeLabel: 'Acara', sub: 'Penilaian Akhir Tahun, pelepasan siswa kelas 9, dan pembagian rapor' },
      { id: 'c9', date: 'Jun–Jul 2026', title: 'Libur Akhir Tahun Ajaran', type: 'libur', typeLabel: 'Libur', sub: 'Libur kenaikan kelas dan persiapan tahun ajaran baru' },
    ],
    // Phase 3: download is sourced from DocumentSlot 'kalender-akademik' at
    // assembler runtime via getDocumentSlotWithMedia. Static config holds null
    // so the static-mode build still type-checks; the assembler overwrites it.
    documentSlot: null,
  },
  ctaFinal: {
    title: 'Ingin Tahu Lebih Banyak?',
    subtitle: 'Hubungi kami untuk informasi lebih lanjut tentang program akademik atau kunjungan sekolah.',
    primary: { label: 'Hubungi Kami', href: '/kontak' },
    secondary: { label: 'Lihat Fasilitas', href: '/fasilitas', icon: '→' },
  },
};

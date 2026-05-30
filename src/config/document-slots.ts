/**
 * Phase 3: the fixed allowlist of DocumentSlot ids. Any addition here MUST be
 * paired with a seed update in scripts/seed-content.ts (so the row actually
 * exists) and a public-side wiring (assembler + section render).
 *
 * Defense-in-depth: the Zod enum in the admin action rejects any value not
 * present here, so an attacker can't talk the action into mutating an
 * arbitrary slot id.
 */
export const DOCUMENT_SLOT_IDS = ['kalender-akademik', 'tata-tertib'] as const;
export type DocumentSlotId = (typeof DOCUMENT_SLOT_IDS)[number];

export const DOCUMENT_SLOT_LABEL: Record<DocumentSlotId, string> = {
  'kalender-akademik': 'Kalender Akademik',
  'tata-tertib': 'Tata Tertib Sekolah',
};

export const DOCUMENT_SLOT_DESCRIPTION: Record<DocumentSlotId, string> = {
  'kalender-akademik':
    'PDF kalender akademik yang muncul di tombol unduh halaman Akademik.',
  'tata-tertib':
    'PDF buku tata tertib yang muncul di tombol unduh halaman Fasilitas.',
};

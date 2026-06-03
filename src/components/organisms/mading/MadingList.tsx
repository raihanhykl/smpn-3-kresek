'use client';

import { useMemo, useState } from 'react';
import type { Mading } from '@config/types';
import { MadingCard } from './MadingCard';

type SortKey = 'newest' | 'oldest' | 'title';

export function MadingList({ items }: { items: Mading[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter((m) => `${m.title} ${m.body ?? ''}`.toLowerCase().includes(q))
      : items.slice();
    filtered.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'id');
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sort === 'oldest' ? da - db : db - da;
    });
    return filtered;
  }, [items, query, sort]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari berita…"
          className="w-full rounded-md border border-neutral-300 px-4 py-2 text-sm sm:max-w-xs"
          aria-label="Cari mading"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          aria-label="Urutkan mading"
        >
          <option value="newest">Terbaru</option>
          <option value="oldest">Terlama</option>
          <option value="title">Judul A–Z</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="py-16 text-center text-neutral-500">
          {query ? 'Tidak ada hasil untuk pencarian ini.' : 'Belum ada postingan mading.'}
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((m) => <MadingCard key={m.id} item={m} />)}
        </div>
      )}
    </div>
  );
}

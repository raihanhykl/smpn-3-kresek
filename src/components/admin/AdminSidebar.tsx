'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminNav } from '@config/admin-nav';
import type { Role } from '@/lib/auth/require-role';

export function AdminSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <nav className="flex h-full w-60 shrink-0 flex-col gap-6 border-r border-neutral-200 bg-white px-4 py-6">
      <div className="px-2">
        <span className="font-heading text-lg font-extrabold text-primary">SMPN 3 Kresek</span>
        <p className="text-xs text-neutral-500">Panel Admin</p>
      </div>
      {adminNav.map((group) => {
        const visible = group.items.filter((i) => i.roles.includes(role));
        if (visible.length === 0) return null;
        return (
          <div key={group.heading}>
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              {group.heading}
            </p>
            <ul className="space-y-1">
              {visible.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      <span aria-hidden>{item.icon}</span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

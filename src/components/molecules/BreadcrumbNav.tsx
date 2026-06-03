import type { PageHeaderConfig } from '@config/types';

export function BreadcrumbNav({ items }: { items: NonNullable<PageHeaderConfig['breadcrumb']> }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-2 text-sm text-white/60">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={`${item.label}-${idx}`} className="flex items-center gap-2">
            {item.href && !isLast ? (
              <a href={item.href} className="transition-colors hover:text-white">
                {item.label}
              </a>
            ) : (
              <span className={isLast ? 'text-white' : ''}>{item.label}</span>
            )}
            {!isLast ? <span className="text-white/30">›</span> : null}
          </span>
        );
      })}
    </nav>
  );
}

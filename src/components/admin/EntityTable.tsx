'use client';

import { useMemo, useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export type Column<Row> = {
  header: string;
  cell: (row: Row) => React.ReactNode;
};

export function EntityTable<Row>({
  rows, getId, getSearchText, columns, onEdit, onDelete, onReorder, addButton,
  reorderable = true,
}: {
  rows: Row[];
  getId: (row: Row) => string;
  getSearchText: (row: Row) => string;
  columns: Column<Row>[];
  onEdit: (row: Row) => void;
  onDelete: (row: Row) => void;
  // Optional when reorderable=false (no drag handles, no reorder calls).
  onReorder?: (orderedIds: string[]) => void;
  addButton?: React.ReactNode;
  // When false, drag handles are hidden and rows cannot be reordered. Use for
  // entities ordered by an intrinsic key (e.g. Mading sorts by date), where a
  // drag affordance would be misleading. Defaults to true for all existing
  // managers.
  reorderable?: boolean;
}) {
  const [query, setQuery] = useState('');
  // Local order mirror so drag feels instant; server reorder fires onDragEnd.
  const [orderedIds, setOrderedIds] = useState<string[]>(() => rows.map(getId));

  const rowsById = useMemo(() => {
    const m = new Map<string, Row>();
    for (const r of rows) m.set(getId(r), r);
    return m;
  }, [rows, getId]);

  // Reconcile local order when the server rows change (after a mutation +
  // router refresh). Uses the "store previous prop" pattern — set state DURING
  // render (React-supported, no effect, no flash) rather than setState-in-useMemo
  // (anti-pattern) or useEffect (extra render). React bails out of the re-render
  // if the value is unchanged.
  const serverIds = rows.map(getId).join(',');
  const [prevServerIds, setPrevServerIds] = useState(serverIds);
  if (serverIds !== prevServerIds) {
    setPrevServerIds(serverIds);
    setOrderedIds(rows.map(getId));
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const visibleIds = orderedIds.filter((id) => {
    const row = rowsById.get(id);
    if (!row) return false;
    if (!query.trim()) return true;
    return getSearchText(row).toLowerCase().includes(query.trim().toLowerCase());
  });

  // Reordering only meaningful on the full list, and only when the entity is
  // reorderable at all.
  const dragDisabled = !reorderable || query.trim().length > 0;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    const next = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(next);
    onReorder?.(next);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <input
          type="search"
          placeholder="Cari…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-64 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {addButton}
      </div>

      {visibleIds.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          Tidak ada data.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    {reorderable ? <th className="w-8 px-3 py-2" aria-label="Urutkan" /> : null}
                    {columns.map((c) => (
                      <th key={c.header} className="px-3 py-2">{c.header}</th>
                    ))}
                    <th className="px-3 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleIds.map((id) => {
                    const row = rowsById.get(id)!;
                    return (
                      <SortableRow
                        key={id}
                        id={id}
                        dragDisabled={dragDisabled}
                        reorderable={reorderable}
                        columns={columns}
                        row={row}
                        onEdit={() => onEdit(row)}
                        onDelete={() => onDelete(row)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

function SortableRow<Row>({
  id, row, columns, onEdit, onDelete, dragDisabled, reorderable,
}: {
  id: string;
  row: Row;
  columns: Column<Row>[];
  onEdit: () => void;
  onDelete: () => void;
  dragDisabled: boolean;
  reorderable: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: dragDisabled });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <tr ref={setNodeRef} style={style} className="border-b border-neutral-100 last:border-0">
      {reorderable ? (
        <td className="px-3 py-2 align-middle">
          <button
            type="button"
            className="cursor-grab text-neutral-400 disabled:cursor-not-allowed disabled:opacity-30"
            disabled={dragDisabled}
            aria-label="Seret untuk urutkan"
            {...attributes}
            {...listeners}
          >
            ⠿
          </button>
        </td>
      ) : null}
      {columns.map((c) => (
        <td key={c.header} className="px-3 py-2 align-middle text-neutral-800">{c.cell(row)}</td>
      ))}
      <td className="px-3 py-2 text-right align-middle">
        <button type="button" onClick={onEdit} className="mr-2 text-sm font-medium text-primary hover:underline">
          Edit
        </button>
        <button type="button" onClick={onDelete} className="text-sm font-medium text-red-600 hover:underline">
          Hapus
        </button>
      </td>
    </tr>
  );
}

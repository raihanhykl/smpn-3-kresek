import { unstable_cache } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import type { Mading, MadingImage } from '@config/types';
import { madingImageSchema } from '@/lib/validation/schemas/entities/mading';

type MadingRow = {
  id: string;
  title: string;
  body: string | null;
  images: Prisma.JsonValue;
  createdAt: Date;
};

// Defensive: a malformed images column must never crash a read.
const imagesParser = z.array(madingImageSchema).catch([] as MadingImage[]);

function rowToMading(r: MadingRow): Mading {
  const item: Mading = {
    id: r.id,
    title: r.title,
    images: imagesParser.parse(r.images),
    createdAt: r.createdAt.toISOString(),
  };
  if (r.body && r.body.trim().length > 0) item.body = r.body;
  return item;
}

async function loadAllMading(): Promise<Mading[]> {
  const rows = await prisma.mading.findMany({ orderBy: [{ createdAt: 'desc' }] });
  return rows.map(rowToMading);
}

export const getAllMading = unstable_cache(loadAllMading, ['mading', 'all'], {
  tags: ['mading'],
});

export async function getMadingById(id: string): Promise<Mading | null> {
  const row = await prisma.mading.findUnique({ where: { id } });
  return row ? rowToMading(row) : null;
}

export type MadingInput = {
  title: string;
  body?: string | undefined;
  images: MadingImage[];
};

function inputToData(input: MadingInput) {
  return {
    title: input.title,
    body: input.body && input.body.trim().length > 0 ? input.body : null,
    images: input.images as unknown as Prisma.InputJsonValue,
  };
}

export async function createMading(input: MadingInput): Promise<Mading> {
  const max = await prisma.mading.aggregate({ _max: { order: true } });
  const order = (max._max.order ?? -1) + 1;
  const row = await prisma.mading.create({ data: { ...inputToData(input), order } });
  return rowToMading(row);
}

export async function updateMading(id: string, input: MadingInput): Promise<Mading> {
  const row = await prisma.mading.update({ where: { id }, data: inputToData(input) });
  return rowToMading(row);
}

export async function deleteMading(id: string): Promise<void> {
  await prisma.mading.delete({ where: { id } });
}

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';

export type AuditInput = {
  userId: string;
  action: string;
  target: string;
  metadata?: Record<string, unknown>;
};

export async function writeAudit(input: AuditInput): Promise<void> {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    userId: input.userId,
    action: input.action,
    target: input.target,
  };
  if (input.metadata !== undefined) {
    data.metadata = input.metadata as Prisma.InputJsonValue;
  }
  await prisma.auditLog.create({ data });
}

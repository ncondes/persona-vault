import { Prisma, PrismaClient } from '../../generated/prisma/client';

// The executor a repository runs against: either the base client or a
// transaction-scoped client. This lets the same repository code run inside or
// outside a transaction.
export type DbClient = PrismaClient | Prisma.TransactionClient;

import { Repositories, UnitOfWork } from '../domain/interfaces/unit-of-work';
import { PrismaClient } from '../generated/prisma/client';
import { createRepositories } from './index';

// Runs a unit of work inside a single Prisma interactive transaction. The
// repositories handed to the callback are bound to the transaction, so all their
// writes commit together or roll back together.
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => work(createRepositories(tx)));
  }
}

import { AuthController } from './controllers/auth.controller';
import { HealthController } from './controllers/health.controller';
import { Repositories, UnitOfWork } from './domain/interfaces/unit-of-work';
import { prisma } from './infrastructure/db/prisma';
import { createRepositories } from './repositories';
import { PrismaUnitOfWork } from './repositories/unit-of-work';
import { AuthService, AuthServiceImpl } from './services/auth.service';

// Wires the application's dependencies together at startup.
// Order: infrastructure -> repositories -> services -> controllers.
export class Container {
  readonly repositories: Repositories;
  readonly unitOfWork: UnitOfWork;
  readonly authService: AuthService;
  readonly healthController: HealthController;
  readonly authController: AuthController;

  constructor() {
    // repositories (bound to the shared client for non-transactional work)
    this.repositories = createRepositories(prisma);
    this.unitOfWork = new PrismaUnitOfWork(prisma);

    // services
    this.authService = new AuthServiceImpl(this.repositories.users);

    // controllers
    this.healthController = new HealthController();
    this.authController = new AuthController(this.authService, this.repositories.users);
  }
}

export function buildContainer(): Container {
  return new Container();
}

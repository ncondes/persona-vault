import { AccountController } from './controllers/account.controller';
import { AuthController } from './controllers/auth.controller';
import { HealthController } from './controllers/health.controller';
import { WebController } from './controllers/web.controller';
import { Repositories, UnitOfWork } from './domain/interfaces/unit-of-work';
import { prisma } from './infrastructure/db/prisma';
import { createRepositories } from './repositories';
import { PrismaUnitOfWork } from './repositories/unit-of-work';
import { AccountService, AccountServiceImpl } from './services/account.service';
import { AuthService, AuthServiceImpl } from './services/auth.service';
import { ContextService, ContextServiceImpl } from './services/context.service';

// Wires the application's dependencies together at startup.
// Order: infrastructure -> repositories -> services -> controllers.
export class Container {
  readonly repositories: Repositories;
  readonly unitOfWork: UnitOfWork;
  readonly authService: AuthService;
  readonly contextService: ContextService;
  readonly accountService: AccountService;
  readonly healthController: HealthController;
  readonly authController: AuthController;
  readonly accountController: AccountController;
  readonly webController: WebController;

  constructor() {
    // repositories (bound to the shared client for non-transactional work)
    this.repositories = createRepositories(prisma);
    this.unitOfWork = new PrismaUnitOfWork(prisma);

    // services
    this.authService = new AuthServiceImpl(this.repositories.users);
    this.contextService = new ContextServiceImpl(this.repositories.vault, this.repositories.clients);
    this.accountService = new AccountServiceImpl(this.repositories);

    // controllers
    this.healthController = new HealthController();
    this.authController = new AuthController(this.authService, this.repositories.users);
    this.accountController = new AccountController(this.accountService);
    this.webController = new WebController(
      this.authService,
      this.accountService,
      this.repositories,
    );
  }
}

export function buildContainer(): Container {
  return new Container();
}

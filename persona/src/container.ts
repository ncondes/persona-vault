import { AccountController } from './controllers/account.controller';
import { AuthController } from './controllers/auth.controller';
import { HealthController } from './controllers/health.controller';
import { ProfileController } from './controllers/profile.controller';
import { Repositories, UnitOfWork } from './domain/interfaces/unit-of-work';
import { prisma } from './infrastructure/db/prisma';
import { createRepositories } from './repositories';
import { PrismaUnitOfWork } from './repositories/unit-of-work';
import { AccountService, AccountServiceImpl } from './services/account.service';
import { AuthService, AuthServiceImpl } from './services/auth.service';
import { ContextService, ContextServiceImpl } from './services/context.service';
import { ProfileService, ProfileServiceImpl } from './services/profile.service';

// Wires the application's dependencies together at startup.
// Order: infrastructure -> repositories -> services -> controllers.
export class Container {
  readonly repositories: Repositories;
  readonly unitOfWork: UnitOfWork;
  readonly authService: AuthService;
  readonly profileService: ProfileService;
  readonly contextService: ContextService;
  readonly accountService: AccountService;
  readonly healthController: HealthController;
  readonly authController: AuthController;
  readonly profileController: ProfileController;
  readonly accountController: AccountController;

  constructor() {
    // repositories (bound to the shared client for non-transactional work)
    this.repositories = createRepositories(prisma);
    this.unitOfWork = new PrismaUnitOfWork(prisma);

    // services
    this.authService = new AuthServiceImpl(this.repositories.users);
    this.profileService = new ProfileServiceImpl(this.repositories, this.unitOfWork);
    this.contextService = new ContextServiceImpl(this.repositories.profiles, this.repositories.clients);
    this.accountService = new AccountServiceImpl(this.repositories);

    // controllers
    this.healthController = new HealthController();
    this.authController = new AuthController(this.authService, this.repositories.users);
    this.profileController = new ProfileController(this.profileService);
    this.accountController = new AccountController(this.accountService);
  }
}

export function buildContainer(): Container {
  return new Container();
}

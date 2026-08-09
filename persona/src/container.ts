import { AccountController } from './controllers/account.controller';
import { AppController } from './controllers/app.controller';
import { AuthController } from './controllers/auth.controller';
import { HealthController } from './controllers/health.controller';
import { Repositories, UnitOfWork } from './domain/interfaces/unit-of-work';
import { prisma } from './infrastructure/db/prisma';
import { createRepositories } from './repositories';
import { PrismaUnitOfWork } from './repositories/unit-of-work';
import { AccountService, AccountServiceImpl } from './services/account.service';
import { AuthService, AuthServiceImpl } from './services/auth.service';
import { ClientService, ClientServiceImpl } from './services/client.service';
import { ContextService, ContextServiceImpl } from './services/context.service';
import { InteractionService } from './services/interaction.service';
import { VaultService, VaultServiceImpl } from './services/vault.service';
import { VaultController } from './controllers/vault.controller';

// Wires the application's dependencies together at startup.
// Order: infrastructure -> repositories -> services -> controllers.
export class Container {
  readonly repositories: Repositories;
  readonly unitOfWork: UnitOfWork;
  readonly authService: AuthService;
  readonly vaultService: VaultService;
  readonly contextService: ContextService;
  readonly clientService: ClientService;
  readonly interactionService: InteractionService;
  readonly accountService: AccountService;
  readonly healthController: HealthController;
  readonly authController: AuthController;
  readonly vaultController: VaultController;
  readonly accountController: AccountController;
  readonly appController: AppController;

  constructor() {
    // repositories (bound to the shared client for non-transactional work)
    this.repositories = createRepositories(prisma);
    this.unitOfWork = new PrismaUnitOfWork(prisma);

    // services
    this.authService = new AuthServiceImpl(this.repositories.users, this.unitOfWork);
    this.vaultService = new VaultServiceImpl(this.repositories, this.unitOfWork);
    this.contextService = new ContextServiceImpl(
      this.repositories.vault,
      this.repositories.clients,
      this.repositories.consents,
    );
    this.clientService = new ClientServiceImpl(this.repositories);
    this.interactionService = new InteractionService(this.repositories);
    this.accountService = new AccountServiceImpl(this.repositories);

    // controllers
    this.healthController = new HealthController();
    this.authController = new AuthController(this.authService, this.repositories.users);
    this.vaultController = new VaultController(this.vaultService);
    this.accountController = new AccountController(this.accountService);
    this.appController = new AppController(this.clientService);
  }
}

export function buildContainer(): Container {
  return new Container();
}

import { AccountController } from './controllers/account.controller';
import { AppController } from './controllers/app.controller';
import { AuthController } from './controllers/auth.controller';
import { HealthController } from './controllers/health.controller';
import { config } from './config/config';
import { Mailer } from './domain/interfaces/mailer';
import { Clock, RateLimitStore, systemClock } from './domain/interfaces/rate-limit';
import { Repositories, UnitOfWork } from './domain/interfaces/unit-of-work';
import { prisma } from './infrastructure/db/prisma';
import { MemoryRateLimitStore } from './infrastructure/rate-limit/memory.store';
import { RedisRateLimitStore } from './infrastructure/rate-limit/redis.store';
import { logger } from './infrastructure/logger/logger';
import { buildRateLimiter, RateLimiter } from './middlewares/rateLimit.middleware';
import { ConsoleMailer } from './infrastructure/mail/console.mailer';
import { ResendMailer } from './infrastructure/mail/resend.mailer';
import { createRepositories } from './repositories';
import { PrismaUnitOfWork } from './repositories/unit-of-work';
import { AccountService, AccountServiceImpl } from './services/account.service';
import { AuthService, AuthServiceImpl } from './services/auth.service';
import { ClientService, ClientServiceImpl } from './services/client.service';
import { ContextService, ContextServiceImpl } from './services/context.service';
import { InteractionService } from './services/interaction.service';
import { OtpService, OtpServiceImpl } from './services/otp.service';
import { SigningKeyService } from './services/signing-key.service';
import { VaultService, VaultServiceImpl } from './services/vault.service';
import { VaultController } from './controllers/vault.controller';

// The dependencies worth swapping from outside. Integration tests boot the real
// container against the real database, and without the mailer they would send
// mail — or fail trying — on every sign-up. The store and the clock are here for
// the same reason: a unit test should not need Redis, and no test should have to
// wait out a real window to watch a bucket refill.
export interface ContainerOverrides {
  mailer?: Mailer;
  rateLimitStore?: RateLimitStore;
  clock?: Clock;
}

// Wires the application's dependencies together at startup.
// Order: infrastructure -> repositories -> services -> controllers.
// Which way outbound mail goes. `console` is opt-in and refused in production
// by config.ts, so this cannot quietly become the transport in a real deployment.
function buildMailer(): Mailer {
  return config.mailTransport === 'console'
    ? new ConsoleMailer()
    : new ResendMailer(config.resendApiKey, config.emailFrom);
}

// Redis when there is one, an in-process map when there is not. config.ts
// refuses to start production without REDIS_URL, so the fallback can only be
// reached locally and in tests — but it still says so, because a limiter that
// silently forgets everything on restart is worth noticing.
function buildRateLimitStore(clock: Clock): RateLimitStore {
  if (config.redisUrl) {
    return new RedisRateLimitStore(config.redisUrl);
  }
  if (!config.isTest) {
    logger.warn('REDIS_URL is unset — rate limits are per-process and reset on restart');
  }
  return new MemoryRateLimitStore(clock);
}

export class Container {
  readonly repositories: Repositories;
  readonly unitOfWork: UnitOfWork;
  readonly mailer: Mailer;
  readonly clock: Clock;
  readonly rateLimitStore: RateLimitStore;
  readonly rateLimit: RateLimiter;
  readonly otpService: OtpService;
  readonly authService: AuthService;
  readonly vaultService: VaultService;
  readonly contextService: ContextService;
  readonly clientService: ClientService;
  readonly interactionService: InteractionService;
  readonly accountService: AccountService;
  readonly signingKeyService: SigningKeyService;
  readonly healthController: HealthController;
  readonly authController: AuthController;
  readonly vaultController: VaultController;
  readonly accountController: AccountController;
  readonly appController: AppController;

  constructor(overrides: ContainerOverrides = {}) {
    // infrastructure
    this.mailer = overrides.mailer ?? buildMailer();
    this.clock = overrides.clock ?? systemClock;
    this.rateLimitStore = overrides.rateLimitStore ?? buildRateLimitStore(this.clock);
    this.rateLimit = buildRateLimiter(this.rateLimitStore, this.clock);

    // repositories (bound to the shared client for non-transactional work)
    this.repositories = createRepositories(prisma);
    this.unitOfWork = new PrismaUnitOfWork(prisma);

    // services
    this.otpService = new OtpServiceImpl(this.repositories.otpChallenges, this.mailer);
    this.authService = new AuthServiceImpl(
      this.repositories.users,
      this.unitOfWork,
      this.otpService,
    );
    this.vaultService = new VaultServiceImpl(this.repositories, this.unitOfWork);
    this.contextService = new ContextServiceImpl(
      this.repositories.vault,
      this.repositories.clients,
      this.repositories.consents,
    );
    this.clientService = new ClientServiceImpl(this.repositories);
    this.interactionService = new InteractionService(this.repositories);
    this.accountService = new AccountServiceImpl(this.repositories);
    this.signingKeyService = new SigningKeyService(
      this.repositories.signingKeys,
      () => this.clock.now(),
    );

    // controllers
    this.healthController = new HealthController();
    this.authController = new AuthController(
      this.authService,
      this.otpService,
      this.repositories.users,
    );
    this.vaultController = new VaultController(this.vaultService);
    this.accountController = new AccountController(this.accountService);
    this.appController = new AppController(this.clientService);
  }
}

export function buildContainer(overrides: ContainerOverrides = {}): Container {
  return new Container(overrides);
}

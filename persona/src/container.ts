import { HealthController } from './controllers/health.controller';

// Wires the application's dependencies together at startup.
// Order grows with the app: infrastructure -> repositories -> services -> controllers.
export class Container {
  readonly healthController: HealthController;

  constructor() {
    this.healthController = new HealthController();
  }
}

export function buildContainer(): Container {
  return new Container();
}

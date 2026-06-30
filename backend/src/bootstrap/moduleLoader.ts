import { Express } from 'express';
import { EventBus } from '../@shared/infrastructure/eventBus/EventBus';
import { logger } from '../@shared/infrastructure/logger/Logger';

interface ModuleManifest {
  name: string;
  version: string;
  dependencies: string[];
  permissions: string[];
}

export class ModuleLoader {
  private modules: Map<string, ModuleManifest> = new Map();

  register(manifest: ModuleManifest): void {
    this.modules.set(manifest.name, manifest);
    logger.info({ module: manifest.name }, 'Module registered');
  }

  loadForTenant(app: Express, eventBus: EventBus, enabledModules: string[]): void {
    for (const moduleName of enabledModules) {
      const manifest = this.modules.get(moduleName);
      if (!manifest) {
        logger.warn({ module: moduleName }, 'Module not found in registry');
        continue;
      }
      logger.info({ module: moduleName }, 'Activating module for tenant');
    }
  }
}

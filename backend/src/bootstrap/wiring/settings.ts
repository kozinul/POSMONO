import { asClass, Lifetime } from 'awilix';
import { MongoSettingRepository } from '../../core/settings/infrastructure/persistence/MongoSettingRepository';
import { SettingService } from '../../core/settings/application/services/SettingService';
import { SettingController } from '../../core/settings/interfaces/http/controllers/SettingController';
import type { WiringContext } from './types';

/**
 * Registers the tenant settings domain (general POS settings: rounding, QRIS
 * gateway, receipt/print toggles).
 */
export function registerSettingsWiring({ container, models }: WiringContext): void {
  container.register({
    settingRepository: asClass(MongoSettingRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.SettingModel,
      }),
    }),
    settingService: asClass(SettingService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        settingRepository: container.resolve('settingRepository'),
      }),
    }),
    settingController: asClass(SettingController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        settingService: container.resolve('settingService'),
      }),
    }),
  });
}

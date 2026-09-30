import { asClass, Lifetime } from 'awilix';
import { UploadService } from '../../core/upload/application/services/UploadService';
import { UploadController } from '../../core/upload/interfaces/http/controllers/UploadController';
import type { WiringContext } from './types';

/**
 * Registers the upload domain — no repository, the service owns the
 * storage backend choice. Smallest domain in the platform; kept in stage 2
 * to prove the wiring pattern on a near-zero-risk slice.
 */
export function registerUploadWiring({ container }: WiringContext): void {
  container.register({
    uploadService: asClass(UploadService, {
      lifetime: Lifetime.SINGLETON,
    }),
    uploadController: asClass(UploadController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        uploadService: container.resolve('uploadService'),
      }),
    }),
  });
}

import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { UploadService } from '../../../application/services/UploadService';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

export class UploadController extends BaseController {
  constructor(private readonly uploadService: UploadService) {
    super();
  }

  getMiddleware() {
    return this.uploadService.getMiddleware();
  }

  async upload(req: Request, res: Response): Promise<void> {
    if (!req.file) throw new ValidationError('No file uploaded');

    const result = await this.uploadService.upload(req.file, {
      width: req.body.width ? parseInt(req.body.width as string) : undefined,
      height: req.body.height ? parseInt(req.body.height as string) : undefined,
      quality: req.body.quality ? parseInt(req.body.quality as string) : undefined,
      format: req.body.format as 'jpeg' | 'png' | 'webp' | undefined,
      folder: req.body.folder as string | undefined,
    });

    this.ok(res, result);
  }

  async uploadMultiple(req: Request, res: Response): Promise<void> {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      throw new ValidationError('No files uploaded');
    }

    const results = await this.uploadService.uploadMultiple(req.files as Express.Multer.File[], {
      width: req.body.width ? parseInt(req.body.width as string) : undefined,
      height: req.body.height ? parseInt(req.body.height as string) : undefined,
      quality: req.body.quality ? parseInt(req.body.quality as string) : undefined,
      format: req.body.format as 'jpeg' | 'png' | 'webp' | undefined,
      folder: req.body.folder as string | undefined,
    });

    this.ok(res, results);
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { path: filePath } = req.body;
    if (!filePath) throw new ValidationError('File path is required');

    await this.uploadService.delete(filePath);
    this.ok(res, { deleted: true });
  }
}

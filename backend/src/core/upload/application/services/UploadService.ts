import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = path.resolve(__dirname, '../../../../uploads');

export interface UploadResult {
  id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  width?: number;
  height?: number;
  url: string;
  path: string;
}

export class UploadService {
  private multerInstance: multer.Multer;

  constructor() {
    this.multerInstance = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (_req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
        }
      },
    });
  }

  getMiddleware() {
    return this.multerInstance;
  }

  async processImage(buffer: Buffer, options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
  }): Promise<Buffer> {
    let pipeline = sharp(buffer);

    if (options.width || options.height) {
      pipeline = pipeline.resize(options.width, options.height, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    const format = options.format || 'webp';
    pipeline = pipeline.toFormat(format, { quality: options.quality ?? 80 });

    return pipeline.toBuffer();
  }

  async upload(file: Express.Multer.File, options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
    folder?: string;
  } = {}): Promise<UploadResult> {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const id = uuidv4();
    const format = options.format || 'webp';
    const folder = options.folder || 'general';
    const filename = `${id}.${format}`;

    const processedBuffer = await this.processImage(file.buffer, {
      width: options.width,
      height: options.height,
      quality: options.quality,
      format,
    });

    const folderPath = path.join(UPLOAD_DIR, folder);
    await fs.mkdir(folderPath, { recursive: true });

    const filePath = path.join(folderPath, filename);
    await fs.writeFile(filePath, processedBuffer);

    const metadata = await sharp(processedBuffer).metadata();

    return {
      id,
      originalName: file.originalname,
      filename,
      mimetype: `image/${format}`,
      size: processedBuffer.length,
      width: metadata.width,
      height: metadata.height,
      url: `/uploads/${folder}/${filename}`,
      path: filePath,
    };
  }

  async uploadMultiple(files: Express.Multer.File[], options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
    folder?: string;
  } = {}): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    for (const file of files) {
      const result = await this.upload(file, options);
      results.push(result);
    }
    return results;
  }

  async delete(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch {
      // File may not exist, ignore
    }
  }
}

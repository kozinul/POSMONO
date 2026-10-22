import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';

// Tests run with cwd = backend/ (root `pnpm test` runs each package in its own dir).
const REPO_ROOT = path.resolve(process.cwd(), '..');
const read = (relativePath: string) => fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');

describe('production container assets', () => {
  describe('docker/Dockerfile', () => {
    const dockerfile = read('docker/Dockerfile');

    it('drops root privileges in the runner stage', () => {
      const runner = dockerfile.slice(dockerfile.indexOf('AS runner'));

      expect(runner).toMatch(/^USER node$/m);
      expect(runner.indexOf('USER node')).toBeLessThan(runner.indexOf('CMD ['));
    });

    it('creates the writable uploads and logs directories before switching user', () => {
      const chown = dockerfile.indexOf('chown -R node:node /app/backend/dist/uploads /app/logs');

      expect(chown).toBeGreaterThan(-1);
      expect(chown).toBeLessThan(dockerfile.indexOf('USER node'));
    });

    it('declares an image-level healthcheck on /api/health', () => {
      expect(dockerfile).toMatch(/HEALTHCHECK[\s\S]*http:\/\/127\.0\.0\.1:3000\/api\/health/);
    });
  });

  describe('docker/docker-compose.prod.yml', () => {
    const compose = read('docker/docker-compose.prod.yml');

    it('mounts the initdb script and passes app credentials to mongodb', () => {
      expect(compose).toContain('./mongo-init:/docker-entrypoint-initdb.d:ro');
      expect(compose).toContain('MONGO_APP_USERNAME: ${MONGO_APP_USERNAME:?');
      expect(compose).toContain('MONGO_APP_PASSWORD: ${MONGO_APP_PASSWORD:?');
    });

    it('connects the app with the scoped user, not the root account', () => {
      const uriLine = compose.split('\n').find((line) => line.includes('MONGO_URI:'));

      expect(uriLine).toBeDefined();
      expect(uriLine).toContain('${MONGO_APP_USERNAME}');
      expect(uriLine).toContain('${MONGO_APP_PASSWORD}');
      expect(uriLine).not.toContain('MONGO_INITDB_ROOT');
      expect(uriLine).toContain('authSource=admin');
    });

    it('keeps the mongodb healthcheck authenticated with root', () => {
      expect(compose).toContain('--username "$$MONGO_INITDB_ROOT_USERNAME"');
      expect(compose).toContain('--password "$$MONGO_INITDB_ROOT_PASSWORD"');
    });
  });

  describe('docker/.env.example', () => {
    it('documents both scoped credentials', () => {
      const env = read('docker/.env.example');

      expect(env).toMatch(/^MONGO_APP_USERNAME=/m);
      expect(env).toMatch(/^MONGO_APP_PASSWORD=/m);
    });
  });

  describe('docker/mongo-init/10-app-user.js', () => {
    const script = read('docker/mongo-init/10-app-user.js');

    it('grants only readWrite on the application database', () => {
      expect(script).toContain("role: 'readWrite'");
      expect(script).not.toContain("role: 'root'");
      expect(script).toContain('MONGO_APP_USERNAME');
      expect(script).toContain('MONGO_APP_PASSWORD');
    });

    it('is idempotent and refuses to reuse the root username', () => {
      expect(script).toContain('admin.getUser(username)');
      expect(script).toContain('must differ from MONGO_INITDB_ROOT_USERNAME');
    });
  });
});

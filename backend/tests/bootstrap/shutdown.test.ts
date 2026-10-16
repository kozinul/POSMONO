import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  registerShutdownHandlers,
  SHUTDOWN_TIMEOUT_MS,
  type ClosableServer,
  type ShutdownDeps,
  type ShutdownLogger,
} from '../../src/bootstrap/shutdown';

const flush = () => new Promise((resolve) => setImmediate(resolve));

function createHarness(overrides: Partial<ShutdownDeps> = {}) {
  const listeners = new Map<string, () => void>();
  const logger: ShutdownLogger = { info: vi.fn(), error: vi.fn() };
  const closeDb = vi.fn().mockResolvedValue(undefined);
  const closeSocketServer = vi.fn();
  const closeIdleConnections = vi.fn();
  const exit = vi.fn();

  const httpServer: ClosableServer = {
    close: (callback) => setImmediate(() => callback()),
    closeIdleConnections,
  };

  registerShutdownHandlers({
    httpServer,
    closeDb,
    logger,
    closeSocketServer,
    onSignal: (signal, listener) => listeners.set(signal, listener),
    exit,
    ...overrides,
  });

  return {
    emit: (signal: string) => listeners.get(signal)?.(),
    signals: () => [...listeners.keys()],
    logger,
    closeDb,
    closeSocketServer,
    closeIdleConnections,
    exit,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('registerShutdownHandlers', () => {
  it('registers both SIGTERM and SIGINT', () => {
    const h = createHarness();
    expect(h.signals().sort()).toEqual(['SIGINT', 'SIGTERM']);
  });

  it('drains HTTP, sockets and the database, then exits 0', async () => {
    const h = createHarness();

    h.emit('SIGTERM');
    await flush();

    expect(h.closeSocketServer).toHaveBeenCalledTimes(1);
    expect(h.closeIdleConnections).toHaveBeenCalledTimes(1);
    expect(h.closeDb).toHaveBeenCalledTimes(1);
    expect(h.exit).toHaveBeenCalledWith(0);
    expect(h.logger.error).not.toHaveBeenCalled();
  });

  it('ignores signals that arrive while a shutdown is already running', async () => {
    const h = createHarness();

    h.emit('SIGTERM');
    h.emit('SIGINT');
    h.emit('SIGTERM');
    await flush();

    expect(h.closeDb).toHaveBeenCalledTimes(1);
    expect(h.exit).toHaveBeenCalledTimes(1);
  });

  it('exits 1 when the database connection cannot be closed', async () => {
    const h = createHarness({ closeDb: vi.fn().mockRejectedValue(new Error('boom')) });

    h.emit('SIGTERM');
    await flush();

    expect(h.exit).toHaveBeenCalledWith(1);
    expect(h.logger.error).toHaveBeenCalled();
  });

  it('exits 1 when the HTTP server fails to close', async () => {
    const h = createHarness({
      httpServer: { close: (callback) => setImmediate(() => callback(new Error('close failed'))) },
    });

    h.emit('SIGTERM');
    await flush();

    expect(h.closeDb).not.toHaveBeenCalled();
    expect(h.exit).toHaveBeenCalledWith(1);
  });

  it('tolerates ERR_SERVER_NOT_RUNNING (socket.io may have closed the server first)', async () => {
    const alreadyClosed = Object.assign(new Error('Server is not running.'), {
      code: 'ERR_SERVER_NOT_RUNNING',
    });
    const h = createHarness({
      httpServer: { close: (callback) => setImmediate(() => callback(alreadyClosed)) },
    });

    h.emit('SIGTERM');
    await flush();

    expect(h.closeDb).toHaveBeenCalledTimes(1);
    expect(h.exit).toHaveBeenCalledWith(0);
  });

  it('forces exit 1 when the shutdown exceeds the deadline', async () => {
    vi.useFakeTimers();
    const h = createHarness({
      closeDb: () => new Promise<void>(() => {}),
      timeoutMs: 50,
    });

    h.emit('SIGTERM');
    await vi.advanceTimersByTimeAsync(50);

    expect(h.exit).toHaveBeenCalledWith(1);
    expect(h.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 50 }),
      expect.stringMatching(/timed out/),
    );
  });

  it('uses a 10s deadline by default', () => {
    expect(SHUTDOWN_TIMEOUT_MS).toBe(10_000);
  });
});

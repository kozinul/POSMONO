export interface ClosableServer {
  close(callback: (err?: Error) => void): void;
  closeIdleConnections?(): void;
}

export interface ShutdownLogger {
  info(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
}

export interface ShutdownDeps {
  httpServer: ClosableServer;
  /** Closes the mongoose connection (or any other shared handle). */
  closeDb: () => Promise<void>;
  logger: ShutdownLogger;
  /** Stops the Socket.IO server so long-lived clients cannot block `httpServer.close`. */
  closeSocketServer?: () => void;
  /** Hard deadline before the process is terminated anyway. */
  timeoutMs?: number;
  /** Injectable for tests. */
  onSignal?: (signal: NodeJS.Signals, listener: () => void) => void;
  exit?: (code: number) => void;
}

export const SHUTDOWN_TIMEOUT_MS = 10_000;

/** `io.close()` also closes the HTTP server, so our own `close()` may hit this. */
function isAlreadyClosed(err: Error | undefined): boolean {
  return (err as NodeJS.ErrnoException | undefined)?.code === 'ERR_SERVER_NOT_RUNNING';
}

/**
 * Registers SIGTERM/SIGINT handlers that drain the HTTP server, close the database and
 * exit. Docker sends SIGTERM on `docker stop`/redeploy; without these handlers the
 * process is SIGKILLed after the grace period, cutting in-flight payments mid-write.
 */
export function registerShutdownHandlers(deps: ShutdownDeps): void {
  const {
    httpServer,
    closeDb,
    logger,
    closeSocketServer,
    timeoutMs = SHUTDOWN_TIMEOUT_MS,
    onSignal = (signal, listener) => process.on(signal, listener),
    exit = (code) => process.exit(code),
  } = deps;

  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    // A second Ctrl+C must not race the shutdown already in flight.
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal, timeoutMs }, 'Shutting down gracefully');

    const timer = setTimeout(() => {
      logger.error({ signal, timeoutMs }, 'Graceful shutdown timed out — forcing exit');
      exit(1);
    }, timeoutMs);
    timer.unref?.();

    try {
      closeSocketServer?.();
      httpServer.closeIdleConnections?.();

      await new Promise<void>((resolve, reject) => {
        httpServer.close((err) => (err && !isAlreadyClosed(err) ? reject(err) : resolve()));
      });

      await closeDb();

      clearTimeout(timer);
      logger.info({ signal }, 'Shutdown complete');
      exit(0);
    } catch (err) {
      clearTimeout(timer);
      logger.error({ signal, err }, 'Error during shutdown');
      exit(1);
    }
  };

  onSignal('SIGTERM', () => void shutdown('SIGTERM'));
  onSignal('SIGINT', () => void shutdown('SIGINT'));
}

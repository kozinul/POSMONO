import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { requireModule } from '../../src/@shared/interfaces/middleware/requireModule';

function mockRes() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  } as unknown as Response;
  (res.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
}

describe('requireModule', () => {
  it('calls next when the tenant owns the module', async () => {
    const next = vi.fn();
    const ent = { hasModule: vi.fn(async () => true) };
    await requireModule(ent, 'kds')({ tenantId: 't1' } as Request, mockRes(), next);

    expect(ent.hasModule).toHaveBeenCalledWith('t1', 'kds');
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects with a 403 error when the module is missing', async () => {
    const next = vi.fn();
    const ent = { hasModule: vi.fn(async () => false) };
    await requireModule(ent, 'kds')({ tenantId: 't1' } as Request, mockRes(), next);

    const error = next.mock.calls[0][0] as { statusCode: number; message: string };
    expect(error.statusCode).toBe(403);
    expect(error.message).toContain('kds');
  });

  it('rejects an unauthenticated request', async () => {
    const next = vi.fn();
    await requireModule({ hasModule: vi.fn() }, 'kds')({} as Request, mockRes(), next);

    const error = next.mock.calls[0][0] as { statusCode: number };
    expect(error.statusCode).toBe(401);
  });
});

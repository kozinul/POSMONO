import { describe, it, expect, vi } from 'vitest';
import { ModifierValidationService } from '../../src/core/catalog/application/services/ModifierValidationService';
import { ValidationError } from '../../src/@shared/infrastructure/error/AppError';

function makeGroup(partial: Record<string, unknown> = {}) {
  return {
    id: 'g1',
    tenantId: 'tenant-1',
    name: 'Ukuran',
    displayType: 'radio',
    minSelections: 0,
    maxSelections: 1,
    required: false,
    options: [
      { id: 'o1', name: 'Small', priceAdjustment: 0, isActive: true },
      { id: 'o2', name: 'Large', priceAdjustment: 5000, isActive: true },
      { id: 'o3', name: 'Nonaktif', priceAdjustment: 1000, isActive: false },
    ],
    ...partial,
  };
}

function createMockRepo(groups: Array<Record<string, unknown>>) {
  return {
    findByIds: vi.fn(async (_tenantId: string, ids: string[]) =>
      groups.filter((g) => ids.includes(g.id as string)).map((g) => ({ serialize: () => g })),
    ),
  };
}

describe('ModifierValidationService', () => {
  it('returns empty when no client modifiers and no product groups', async () => {
    const repo = createMockRepo([]);
    const service = new ModifierValidationService(repo);
    const result = await service.validateAndResolve('tenant-1', [], []);
    expect(result).toEqual({ resolvedModifiers: [], totalAdjustment: 0 });
  });

  it('throws when a required group has no selection', async () => {
    const repo = createMockRepo([makeGroup({ required: true, minSelections: 1 })]);
    const service = new ModifierValidationService(repo);
    await expect(
      service.validateAndResolve('tenant-1', ['g1'], []),
    ).rejects.toThrow(ValidationError);
    await expect(
      service.validateAndResolve('tenant-1', ['g1'], []),
    ).rejects.toThrow(/wajib/);
  });

  it('throws when a modifier group does not belong to the product', async () => {
    const repo = createMockRepo([makeGroup()]);
    const service = new ModifierValidationService(repo);
    await expect(
      service.validateAndResolve('tenant-1', ['g1'], [
        { groupId: 'g-other', groupName: 'X', optionId: 'o1', optionName: 'Small', priceAdjustment: 0 },
      ]),
    ).rejects.toThrow(/tidak memiliki modifier group/);
  });

  it('resolves selections using server-side option and computes price adjustment', async () => {
    const repo = createMockRepo([makeGroup()]);
    const service = new ModifierValidationService(repo);
    const result = await service.validateAndResolve('tenant-1', ['g1'], [
      // client sends bogus price; server must use its own
      { groupId: 'g1', groupName: 'Ukuran', optionId: 'o2', optionName: 'Large', priceAdjustment: 99999 },
    ]);
    expect(result.resolvedModifiers).toHaveLength(1);
    expect(result.resolvedModifiers[0]).toMatchObject({
      groupId: 'g1',
      groupName: 'Ukuran',
      optionId: 'o2',
      optionName: 'Large',
      priceAdjustment: 5000,
    });
    expect(result.totalAdjustment).toBe(5000);
  });

  it('throws when required selections are below minSelections', async () => {
    const repo = createMockRepo([makeGroup({ required: true, minSelections: 2, maxSelections: 2 })]);
    const service = new ModifierValidationService(repo);
    await expect(
      service.validateAndResolve('tenant-1', ['g1'], [
        { groupId: 'g1', groupName: 'Ukuran', optionId: 'o1', optionName: 'Small', priceAdjustment: 0 },
      ]),
    ).rejects.toThrow(/minimal 2 opsi/);
  });

  it('throws when selections exceed maxSelections', async () => {
    const repo = createMockRepo([makeGroup({ maxSelections: 1 })]);
    const service = new ModifierValidationService(repo);
    await expect(
      service.validateAndResolve('tenant-1', ['g1'], [
        { groupId: 'g1', groupName: 'Ukuran', optionId: 'o1', optionName: 'Small', priceAdjustment: 0 },
        { groupId: 'g1', groupName: 'Ukuran', optionId: 'o2', optionName: 'Large', priceAdjustment: 5000 },
      ]),
    ).rejects.toThrow(/maksimal 1 opsi/);
  });

  it('rejects selections pointing at inactive or missing options', async () => {
    const repo = createMockRepo([makeGroup()]);
    const service = new ModifierValidationService(repo);
    await expect(
      service.validateAndResolve('tenant-1', ['g1'], [
        { groupId: 'g1', groupName: 'Ukuran', optionId: 'o3', optionName: 'Nonaktif', priceAdjustment: 0 },
      ]),
    ).rejects.toThrow(/tidak valid/);
  });

  it('accepts an optional group with no selection', async () => {
    const repo = createMockRepo([makeGroup({ required: false })]);
    const service = new ModifierValidationService(repo);
    const result = await service.validateAndResolve('tenant-1', ['g1'], []);
    expect(result.resolvedModifiers).toHaveLength(0);
    expect(result.totalAdjustment).toBe(0);
  });
});
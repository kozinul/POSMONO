import type { QueryClient } from '@tanstack/react-query';
import type { Printer } from '@posmono/shared';
import { printViaClient, findPrinterByPurpose } from './PrintClient';
import { fetchPrinters } from '../hooks/usePrinters';

interface TenantLike {
  config?: { autoPrintReceipt?: boolean; autoPrintKot?: boolean };
}

async function loadPrinters(queryClient: QueryClient): Promise<Printer[]> {
  const cached = queryClient.getQueryData<Printer[]>(['printers']);
  if (cached) return cached;
  try {
    return (await queryClient.fetchQuery({ queryKey: ['printers'], queryFn: fetchPrinters })) || [];
  } catch {
    return [];
  }
}

export async function tryClientAutoPrint(
  queryClient: QueryClient,
  purpose: 'receipt' | 'kot',
  thermalBase64: string | null | undefined,
): Promise<void> {
  if (!thermalBase64) return;
  const tenant = queryClient.getQueryData<TenantLike>(['tenant']);
  if (!tenant) return;

  if (purpose === 'receipt' && tenant.config?.autoPrintReceipt === false) return;
  if (purpose === 'kot' && tenant.config?.autoPrintKot === false) return;

  const printers = await loadPrinters(queryClient);
  const target = findPrinterByPurpose(printers, purpose);
  if (!target) return;
  if (target.connectionType !== 'usb' && target.connectionType !== 'bluetooth') return;

  try {
    await printViaClient(target, thermalBase64);
  } catch {
    // client auto-print must never break the POS flow
  }
}

export async function reprintReceipt(queryClient: QueryClient, thermalBase64: string | null | undefined): Promise<'thermal' | 'browser'> {
  if (!thermalBase64) return 'browser';
  const printers = await loadPrinters(queryClient);
  const target = findPrinterByPurpose(printers, 'receipt');
  if (target && (target.connectionType === 'usb' || target.connectionType === 'bluetooth')) {
    const result = await printViaClient(target, thermalBase64);
    if (result.ok) return 'thermal';
  }
  return 'browser';
}

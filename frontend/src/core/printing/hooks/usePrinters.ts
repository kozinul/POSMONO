import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';
import type { Printer } from '@posmono/shared';

export interface PrintResult {
  dispatched: boolean;
  clientPrint: boolean;
  printer: Printer | null;
  buffer?: string;
  error?: string;
  payload?: {
    layout: unknown;
    thermal: string;
    pdf: string;
    paper: unknown;
    templateId: string | null;
    templateName: string | null;
  };
}

async function fetchPrinters(): Promise<Printer[]> {
  const res = await api.get('/printers');
  return res.data.data || [];
}

export { fetchPrinters };

export function usePrinters() {
  return useQuery({
    queryKey: ['printers'],
    queryFn: fetchPrinters,
    staleTime: 30_000,
  });
}

export function useCreatePrinter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Printer, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => {
      const res = await api.post('/printers', input);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['printers'] }),
  });
}

export function useUpdatePrinter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Printer> & { id: string }) => {
      const res = await api.put(`/printers/${id}`, input);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['printers'] }),
  });
}

export function useDeletePrinter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/printers/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['printers'] }),
  });
}

export function useTestPrinter() {
  return useMutation({
    mutationFn: async (id?: string): Promise<PrintResult> => {
      const res = await api.post(id ? `/printers/${id}/test` : '/printers/test', {});
      return res.data.data;
    },
  });
}

export async function printReceipt(input: { orderId: string; paymentId?: string; printerId?: string }): Promise<PrintResult> {
  const res = await api.post('/print/receipt', input);
  return res.data.data;
}

export async function printKot(input: { orderId: string; printerId?: string }): Promise<PrintResult> {
  const res = await api.post(`/print/kot/${input.orderId}`, { printerId: input.printerId });
  return res.data.data;
}

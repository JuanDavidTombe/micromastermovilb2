import { api } from '@/services/api';
import type {
  StockAlerts,
  StockBatch,
  StockEntryPayload,
  StockIngredient,
  StockPageMeta,
  StockSummary,
} from '@/types/models';
import { pickCollection, pickObject } from '@/utils/payload';

function unwrap<T>(data: unknown, key: string): T {
  const found = pickObject(data, key);
  if (!found) throw new Error('La respuesta del servidor no incluye los datos esperados.');
  return found as unknown as T;
}

export const stockService = {
  async getBatches(params?: { search?: string; page?: number; status?: string }): Promise<{
    batches: StockBatch[];
    meta: StockPageMeta;
    summary: StockSummary;
  }> {
    const { data } = await api.get('/stock/batches', { params });
    return {
      batches: pickCollection(data, 'batches') as StockBatch[],
      meta: (pickObject(data, 'meta') ?? {}) as unknown as StockPageMeta,
      summary: (pickObject(data, 'summary') ?? {}) as unknown as StockSummary,
    };
  },

  async getAlerts(): Promise<StockAlerts> {
    const { data } = await api.get('/stock/alerts');
    return data as StockAlerts;
  },

  async getIngredients(): Promise<StockIngredient[]> {
    const { data } = await api.get('/stock/ingredients');
    return pickCollection(data, 'ingredients') as StockIngredient[];
  },

  async registerEntry(payload: StockEntryPayload): Promise<StockBatch> {
    const { data } = await api.post('/stock/entry', payload);
    return unwrap<StockBatch>(data, 'batch');
  },

  async registerExit(batchId: number, quantity: number): Promise<StockBatch> {
    const { data } = await api.post('/stock/exit', { batch_id: batchId, quantity });
    return unwrap<StockBatch>(data, 'batch');
  },

  async registerQrScan(payload: StockEntryPayload & { qr_code_hash: string }): Promise<StockBatch> {
    const { data } = await api.post('/stock/qr-scan', payload);
    return unwrap<StockBatch>(data, 'batch');
  },
};

import { Hub } from './Hub';

export interface HubRepository {
  save(hub: Hub): Promise<void>;
  findById(id: string): Promise<Hub | null>;
  findByName(name: string): Promise<Hub | null>;
  /** Fase 18 — lookup by the normalised hub code. */
  findByCode(code: string): Promise<Hub | null>;
  findAll(): Promise<Hub[]>;
  delete(id: string): Promise<boolean>;
}
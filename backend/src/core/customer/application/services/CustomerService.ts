import { Customer } from '../../domain/Customer';

export class CustomerService {
  constructor(private readonly customerRepository: any) {}

  async create(input: {
    tenantId: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    isMember?: boolean;
    tags?: string[];
    preferences?: Record<string, unknown>;
  }): Promise<Customer> {
    const customer = Customer.create({
      tenantId: input.tenantId,
      name: input.name,
      phone: input.phone ?? '',
      email: input.email ?? '',
      address: input.address ?? '',
      isMember: input.isMember ?? false,
      tags: input.tags ?? [],
      preferences: input.preferences ?? {},
    });

    await this.customerRepository.save(customer);
    return customer;
  }

  async update(input: {
    id: string;
    tenantId: string;
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    isMember?: boolean;
    tags?: string[];
    preferences?: Record<string, unknown>;
  }): Promise<Customer> {
    const customer = await this.customerRepository.findById(input.id);
    if (!customer) throw new Error('Customer not found');

    const data = customer.serialize();
    if (data.tenantId !== input.tenantId) throw new Error('Customer not found');

    const updated = Customer.hydrate({
      ...data,
      name: input.name ?? data.name,
      phone: input.phone ?? data.phone,
      email: input.email ?? data.email,
      address: input.address ?? data.address,
      isMember: input.isMember ?? data.isMember,
      tags: input.tags ?? data.tags,
      preferences: input.preferences ?? data.preferences,
      updatedAt: new Date(),
    });

    await this.customerRepository.save(updated);
    return updated;
  }

  async getById(tenantId: string, id: string): Promise<Customer | null> {
    const customer = await this.customerRepository.findById(id);
    if (!customer || customer.serialize().tenantId !== tenantId) return null;
    return customer;
  }

  async list(tenantId: string, options?: { page?: number; limit?: number }): Promise<{ customers: Customer[]; total: number }> {
    return this.customerRepository.findByTenant(tenantId, options);
  }

  async searchByPhone(tenantId: string, phone: string): Promise<Customer | null> {
    return this.customerRepository.findByPhone(tenantId, phone);
  }

  async search(tenantId: string, query: string): Promise<Customer[]> {
    return this.customerRepository.search(tenantId, query);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const customer = await this.customerRepository.findById(id);
    if (!customer) throw new Error('Customer not found');
    if (customer.serialize().tenantId !== tenantId) throw new Error('Customer not found');
    await this.customerRepository.delete(id);
  }
}

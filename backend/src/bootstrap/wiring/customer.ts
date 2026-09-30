import { asClass, Lifetime } from 'awilix';
import { MongoCustomerRepository } from '../../core/customer/infrastructure/persistence/MongoCustomerRepository';
import { CustomerService } from '../../core/customer/application/services/CustomerService';
import { CustomerController } from '../../core/customer/interfaces/http/controllers/CustomerController';
import type { WiringContext } from './types';

/**
 * Registers the customer domain (members). Deliberately readable/writable by a
 * cashier: creating a member at the POS counter is part of the cashier job, so
 * this domain is not behind `users:write`-style guards.
 */
export function registerCustomerWiring({ container, models }: WiringContext): void {
  container.register({
    customerRepository: asClass(MongoCustomerRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.CustomerModel,
      }),
    }),
    customerService: asClass(CustomerService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        customerRepository: container.resolve('customerRepository'),
      }),
    }),
    customerController: asClass(CustomerController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        customerService: container.resolve('customerService'),
      }),
    }),
  });
}

import { asClass, Lifetime } from 'awilix';
import { MongoUserRepository } from '../../core/identity/infrastructure/persistence/MongoUserRepository';
import { MongoRoleRepository } from '../../core/identity/infrastructure/persistence/MongoRoleRepository';
import { PasswordService } from '../../core/identity/domain/services/PasswordService';
import { TokenService } from '../../core/identity/application/services/TokenService';
import { SessionService } from '../../core/identity/application/services/SessionService';
import { RoleService } from '../../core/identity/application/services/RoleService';
import { UserService } from '../../core/identity/application/services/UserService';
import { AuthService } from '../../core/identity/application/services/AuthService';
import { AuthController } from '../../core/identity/interfaces/http/controllers/AuthController';
import { RoleController } from '../../core/identity/interfaces/http/controllers/RoleController';
import { UserController } from '../../core/identity/interfaces/http/controllers/UserController';
import { PermissionController } from '../../core/identity/interfaces/http/controllers/PermissionController';
import type { WiringContext } from './types';

/**
 * Registers the identity domain: users, roles, sessions, password hashing, JWT
 * issuing and the auth/role/user/permission HTTP controllers.
 *
 * `authService` is where the T1 named-deps object is assembled; it resolves
 * tenant, hub and platform-audit collaborators lazily, so those domains may be
 * registered after this wiring runs.
 */
export function registerIdentityWiring({ container, models }: WiringContext): void {
  container.register({
    userRepository: asClass(MongoUserRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.UserModel,
      }),
    }),
    roleRepository: asClass(MongoRoleRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.RoleModel,
      }),
    }),
    passwordService: asClass(PasswordService, {
      lifetime: Lifetime.SINGLETON,
    }),
    tokenService: asClass(TokenService, {
      lifetime: Lifetime.SINGLETON,
    }),
    sessionService: asClass(SessionService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.SessionModel,
      }),
    }),
    roleService: asClass(RoleService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        roleRepository: container.resolve('roleRepository'),
      }),
    }),
    userService: asClass(UserService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        userRepository: container.resolve('userRepository'),
        passwordService: container.resolve('passwordService'),
        roleRepository: container.resolve('roleRepository'),
      }),
    }),
  });

  container.register({
    authService: asClass(AuthService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        userRepository: container.resolve('userRepository'),
        tokenService: container.resolve('tokenService'),
        passwordService: container.resolve('passwordService'),
        sessionService: container.resolve('sessionService'),
        roleRepository: container.resolve('roleRepository'),
        hubMembershipService: container.resolve('hubMembershipService'),
        hubMemberAccessService: container.resolve('hubMemberAccessService'),
        tenantRepository: container.resolve('tenantRepository'),
      }),
    }),
    authController: asClass(AuthController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        authService: container.resolve('authService'),
      }),
    }),
    roleController: asClass(RoleController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        roleService: container.resolve('roleService'),
      }),
    }),
    userController: asClass(UserController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        userService: container.resolve('userService'),
      }),
    }),
    permissionController: asClass(PermissionController, {
      lifetime: Lifetime.SINGLETON,
    }),
  });
}

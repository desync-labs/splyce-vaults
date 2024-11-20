import { BN } from "@coral-xyz/anchor";

export const ROLES = {
  ROLES_ADMIN: new BN(0),
  VAULTS_ADMIN: new BN(1),
  REPORTING_MANAGER: new BN(2),
  STRATEGIES_MANAGER: new BN(3),
  ACCOUNTANT_ADMIN: new BN(4),
  KYC_PROVIDER: new BN(5),
  KYC_VERIFIED: new BN(6),
};
export const ROLES_BUFFER = {
  ROLES_ADMIN: Buffer.from(
    new Uint8Array(new BigUint64Array([BigInt(0)]).buffer)
  ),
  VAULTS_ADMIN: Buffer.from(
    new Uint8Array(new BigUint64Array([BigInt(1)]).buffer)
  ),
  REPORTING_MANAGER: Buffer.from(
    new Uint8Array(new BigUint64Array([BigInt(2)]).buffer)
  ),
  STRATEGIES_MANAGER: Buffer.from(
    new Uint8Array(new BigUint64Array([BigInt(3)]).buffer)
  ),
  ACCOUNTANT_ADMIN: Buffer.from(
    new Uint8Array(new BigUint64Array([BigInt(4)]).buffer)
  ),
  KYC_PROVIDER: Buffer.from(
    new Uint8Array(new BigUint64Array([BigInt(5)]).buffer)
  ),
  KYC_VERIFIED: Buffer.from(
    new Uint8Array(new BigUint64Array([BigInt(6)]).buffer)
  ),
};

export const errorStrings = {
  addressConstraintViolated:
    "Error Code: ConstraintAddress. Error Number: 2012. Error Message: An address constraint was violated.",
  roleIdInvalid:
    "Error Code: InvalidRoleId. Error Number: 6002. Error Message: Role id is invalid.",
  setRoleAdminMustBeCalledByOwner:
    "Error Code: CannotSetRoleAdmin. Error Number: 6001. Error Message: set_role_admin fn must be called by the owner.",
};

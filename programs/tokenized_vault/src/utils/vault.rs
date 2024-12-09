use anchor_lang::prelude::*;
use access_control::utils::UserRoleAccInfo;

use crate::errors::ErrorCode;
use crate::state::{Vault, WhitelistedAccInfo};

pub fn validate_deposit<'info>(
    vault_loader: &AccountLoader<'info, Vault>,
    kyc_verified: AccountInfo<'info>,
    whitelisted: AccountInfo<'info>,
    is_direct: bool,
    amount: u64
) -> Result<()> {
    if amount == 0 {
        return Err(ErrorCode::ZeroValue.into());
    }

    let vault = vault_loader.load()?;

    if vault.is_shutdown {
        return Err(ErrorCode::VaultShutdown.into());
    }

    if is_direct && !vault.direct_deposit_enabled {
        return Err(ErrorCode::DirectDepositDisabled.into());
    }

    if amount < vault.min_user_deposit {
        return Err(ErrorCode::MinDepositNotReached.into());
    }

    // todo: introduce deposit limit module
    if amount > vault.max_deposit() {
        return Err(ErrorCode::ExceedDepositLimit.into());
    }

    if vault.kyc_verified_only && !kyc_verified.has_role() {
        return Err(ErrorCode::KYCRequired.into());
    }

    if vault.whitelisted_only && !whitelisted.is_whitelisted() {
        return Err(ErrorCode::NotWhitelisted.into());
    }

    Ok(())
}

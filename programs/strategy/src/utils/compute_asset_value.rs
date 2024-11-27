use uint::construct_uint;

// Define a 256-bit unsigned integer type
construct_uint! {
    pub struct U256(4);
}

/// Computes the asset value using U256 arithmetic for higher precision.
/// 
/// # Arguments
/// 
/// * `asset_amount` - The amount of the asset (as u64).
/// * `asset_price` - The price of the asset (as u128).
/// * `asset_decimals` - The number of decimals the asset has (as u8).
/// 
/// # Returns
/// 
/// The computed asset value as a `u64`.
pub fn compute_asset_value(
    asset_amount: u64,
    asset_price: u128,
    asset_decimals: u8,
) -> u128 {
    // Convert inputs to U256
    let asset_amount_u256 = U256::from(asset_amount);
    let asset_price_u256 = U256::from(asset_price);
    let asset_decimals_u256 = U256::from(asset_decimals);

    // Compute scaling factor: 10^(asset_decimals)
    let scaling_factor = U256::from(10).pow(asset_decimals_u256);

    // Calculate asset value: (asset_amount * asset_price) / 10^(asset_decimals)
    let asset_value_u256 = asset_amount_u256
        .checked_mul(asset_price_u256)
        .expect("Multiplication overflow in asset value computation")
        .checked_div(scaling_factor)
        .expect("Division error in asset value computation");

    // Ensure the result fits into u64
    if asset_value_u256 > U256::from(u64::MAX) {
        panic!("Overflow: asset value does not fit into u64");
    }

    asset_value_u256.as_u128()
}

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
pub fn compute_asset_per_swap(
    total_underlying_obtained: u64,
    delta_value: u128,
    total_buy_value: u128,
) -> u64 {
    // Convert inputs to U256
    let total_underlying_obtained_u256 = U256::from(total_underlying_obtained);
    let delta_value_u256 = U256::from(delta_value);
    let total_buy_value_u256 = U256::from(total_buy_value);

    // Calculate asset value: (asset_amount * asset_price) / 10^(asset_decimals)
    let amount_per_swap_u256 = total_underlying_obtained_u256
        .checked_mul(delta_value_u256)
        .expect("Multiplication overflow in asset value computation")
        .checked_div(total_buy_value_u256)
        .expect("Division error in asset value computation");

    // Ensure the result fits into u64
    if amount_per_swap_u256 > U256::from(u64::MAX) {
        panic!("Overflow: amount per swap does not fit into u64");
    }

    amount_per_swap_u256.as_u64()
}
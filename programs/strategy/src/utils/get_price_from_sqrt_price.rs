use uint::construct_uint;

// Define a 256-bit unsigned integer type
construct_uint! {
    pub struct U256(4);
}

pub fn get_price_in_underlying_decimals(
    sqrt_price_x64: u128,
    a_to_b_for_purchase: bool,
    a_decimals: u8,
    b_decimals: u8,
) -> u128 {
    let price = U256::from(sqrt_price_x64);
    let price_x128 = price * price;
    let scaling_factor = U256::from(1_000_000_000_000_000_000_000u128); // 1e21
    let mut price_x128_scaled = price_x128 * scaling_factor;
    price_x128_scaled = price_x128_scaled >> 64;
    price_x128_scaled = price_x128_scaled * scaling_factor;
    price_x128_scaled = price_x128_scaled >> 64;

    // Adjust for decimal differences between tokens
    price_x128_scaled = if a_decimals > b_decimals {
        price_x128_scaled * U256::from(10).pow(U256::from(a_decimals - b_decimals))
    } else if b_decimals > a_decimals {
        price_x128_scaled / U256::from(10).pow(U256::from(b_decimals - a_decimals))
    } else {
        price_x128_scaled
    };

    // Determine USDC's decimals based on `a_to_b_for_purchase`
    // If `a_to_b_for_purchase` is true, USDC is token A
    // If `a_to_b_for_purchase` is false, USDC is token B
    let usdc_decimals = if a_to_b_for_purchase { a_decimals } else { b_decimals };

    // Determine if we need to invert the price
    // We need to invert when USDC is token A (i.e., when `a_to_b_for_purchase` is true)
    let invert = a_to_b_for_purchase;

    if invert {
        // When inversion is needed
        price_x128_scaled = price_x128_scaled * U256::from(10).pow(U256::from(usdc_decimals));
        price_x128_scaled = price_x128_scaled / U256::from(10).pow(U256::from(42));

        // Invert the price
        let scaling_factor = U256::from(1_000_000_000_000_000_000_000u128); // 1e21
        price_x128_scaled = scaling_factor / price_x128_scaled;
        price_x128_scaled = price_x128_scaled / U256::from(10).pow(U256::from(21 - 2 * usdc_decimals));
    } else {
        // No inversion needed
        price_x128_scaled = price_x128_scaled * U256::from(10).pow(U256::from(usdc_decimals));
        price_x128_scaled = price_x128_scaled / U256::from(10).pow(U256::from(42));
    }

    price_x128_scaled.as_u128()
}
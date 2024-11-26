use uint::construct_uint;

// Define a 256-bit unsigned integer type
construct_uint! {
    pub struct U256(4);
}

pub fn get_price_from_sqrt_price_scaled_by_1e42(sqrt_price_x64: u128) -> U256 {
    let price = U256::from(sqrt_price_x64);
    let price_x128 = price * price;
    let scaling_factor = U256::from(1_000_000_000_000_000_000_000u128); // 1e21
    let mut price_x128_scaled = price_x128 * scaling_factor;
    price_x128_scaled = price_x128_scaled >> 64;
    price_x128_scaled = price_x128_scaled * scaling_factor;
    price_x128_scaled >> 64
    // Right bit shifting by n is equivalent to dividing by 2^n
    // So price_x128_scaled >> 128 is the same as price_x128_scaled / 2^128
}
//initially made it return U256, but it's totally fine to return u128
pub fn get_price_in_underlying_decimals(sqrt_price_x64: u128, a_to_b_for_purchase: bool, a_decimals: u8, b_decimals: u8) -> u128 {
    let price = U256::from(sqrt_price_x64);
    let price_x128 = price * price;
    let scaling_factor = U256::from(1_000_000_000_000_000_000_000u128); // 1e21
    let mut price_x128_scaled = price_x128 * scaling_factor;
    price_x128_scaled = price_x128_scaled >> 64;
    price_x128_scaled = price_x128_scaled * scaling_factor;
    price_x128_scaled = price_x128_scaled >> 64;

    price_x128_scaled = if a_decimals > b_decimals {
        // Left shift is equivalent to multiplying by 2^(a_decimals - b_decimals)
        price_x128_scaled * U256::from(10).pow(U256::from(a_decimals - b_decimals))
    } else if a_decimals < b_decimals {
        // Right shift is equivalent to dividing by 2^(b_decimals - a_decimals)
        price_x128_scaled / U256::from(10).pow(U256::from(b_decimals - a_decimals))
    } else {
        price_x128_scaled
    };
    if !a_to_b_for_purchase {
        // When a_to_b_for_purchase is false, we need to scale by b's decimals
        price_x128_scaled = price_x128_scaled * U256::from(10).pow(U256::from(b_decimals));
        price_x128_scaled = price_x128_scaled / U256::from(10).pow(U256::from(42));
    } else {
        //I need to calculate inverted price
    }

    price_x128_scaled.as_u128()
}

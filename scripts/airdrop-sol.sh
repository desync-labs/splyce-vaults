#!/bin/bash

# Define an array of Solana addresses
addresses=(
    "61225DayqqaNBfQaPumYCvXB4c2rPfCwWHKKbkoFcjto" #Tarun/Deployer 
    "F7FLF8hrNk1p493dCjHHVoQJBqfzXVk917BvfAj5r4yJ" #Alex
    "4ruYTu52dKytVqdstu8uQCkuAyH4XmjiPsBw6g8Cnfu2" #Alex
    "5dzouv2qNMDihbQoRWgtPS87MEVwSNxJFU8uppf4Yo3z" #david
    # Add more addresses as needed
)

# Loop through the addresses and airdrop 100 SOL to each
for address in "${addresses[@]}"
do
    echo "Airdropping 100 SOL to $address"
    sudo solana airdrop 100 "$address"
done

echo "Airdrop completed for all addresses."
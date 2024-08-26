import { BN } from "@coral-xyz/anchor";


// Define the SimpleStrategy class
export class SimpleStrategy {
    depositLimit: BN;

    constructor(fields: { depositLimit: BN }) {
        this.depositLimit = fields.depositLimit;
    }
}

// Define the schema for SimpleStrategy
export const SimpleStrategySchema = new Map([
    [
        SimpleStrategy,
        {
            kind: 'struct',
            fields: [
                ['depositLimit', 'u64'],
                // Add other fields as needed
            ],
        },
    ],
]);

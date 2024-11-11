use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid data")]
    InvalidData,

    #[msg("Invalid discriminator")]
    InvalidDiscriminator,

    #[msg("Serialization error")]
    SerializationError,

    #[msg("Invalid recipient")]
    InvalidRecipient,
}

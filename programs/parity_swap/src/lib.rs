use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;

declare_id!("Gf8A8CSDftRjWCjiJPPWoM6ugnW639F78M7mwWQf2u9Q");

/// Maximum number of inputs we will sum to avoid unbounded compute.
pub const MAX_INPUTS: usize = 64;

#[program]
pub mod parity_swap {
    use super::*;

    /// Decide whether to buy or sell based on the parity of the summed inputs,
    /// then forward the matching swap instruction (e.g., Raydium swap) via CPI.
    pub fn execute_parity_swap(
        ctx: Context<ParitySwap>,
        numbers: Vec<i64>,
        buy_ix_data: Vec<u8>,
        sell_ix_data: Vec<u8>,
        buy_accounts_len: u8,
    ) -> Result<()> {
        require!(!numbers.is_empty(), ErrorCode::NoInputs);
        require!(numbers.len() <= MAX_INPUTS, ErrorCode::TooManyInputs);

        let sum: i128 = numbers.iter().map(|n| *n as i128).sum();
        let sum_i64 = i64::try_from(sum).map_err(|_| ErrorCode::SumOverflow)?;
        let is_buy = sum & 1 != 0;

        let buy_len = buy_accounts_len as usize;
        let total_len = ctx.remaining_accounts.len();
        require!(buy_len <= total_len, ErrorCode::InvalidAccountSplit);

        let (ix_data, accounts) = if is_buy {
            (buy_ix_data, &ctx.remaining_accounts[..buy_len])
        } else {
            (sell_ix_data, &ctx.remaining_accounts[buy_len..])
        };

        require!(!accounts.is_empty(), ErrorCode::MissingCpiAccounts);

        // Ensure the caller who signs this transaction is also forwarded to the CPI.
        let authority_key = ctx.accounts.authority.key();
        require!(
            accounts
                .iter()
                .any(|acc| *acc.key == authority_key && acc.is_signer),
            ErrorCode::AuthorityNotForwarded
        );

        let ix = Instruction {
            program_id: ctx.accounts.dex_program.key(),
            accounts: accounts
                .iter()
                .map(|acc| {
                    if acc.is_writable {
                        AccountMeta::new(*acc.key, acc.is_signer)
                    } else {
                        AccountMeta::new_readonly(*acc.key, acc.is_signer)
                    }
                })
                .collect(),
            data: ix_data,
        };

        invoke(&ix, accounts)?;

        emit!(SwapDecision {
            is_buy,
            sum: sum_i64,
            selected_accounts: accounts.len() as u8,
        });

        Ok(())
    }
}

// ============================================================================
// Accounts
// ============================================================================

#[derive(Accounts)]
pub struct ParitySwap<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: External swap program (e.g. Raydium AMM/CLMM). Validated at CPI.
    pub dex_program: AccountInfo<'info>,
}

// ============================================================================
// Events & Errors
// ============================================================================

#[event]
pub struct SwapDecision {
    pub is_buy: bool,
    pub sum: i64,
    pub selected_accounts: u8,
}

#[error_code]
pub enum ErrorCode {
    #[msg("At least one input number is required")]
    NoInputs,

    #[msg("Too many inputs provided")]
    TooManyInputs,

    #[msg("Sum exceeds i64 bounds")]
    SumOverflow,

    #[msg("Invalid account split between buy/sell CPIs")]
    InvalidAccountSplit,

    #[msg("CPI account list cannot be empty")]
    MissingCpiAccounts,

    #[msg("Authority signer must be forwarded to CPI")]
    AuthorityNotForwarded,
}


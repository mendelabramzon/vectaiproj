use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf");

// Constants
pub const VECT_DECIMALS: u32 = 9;
pub const USDC_DECIMALS: u32 = 6;
pub const MIN_PURCHASE_USDC: u64 = 10_000_000; // 10 USDC with 6 decimals
pub const MAX_CLIFF_DURATION: i64 = 730 * 24 * 60 * 60; // 2 years max
pub const MAX_VESTING_DURATION: i64 = 1460 * 24 * 60 * 60; // 4 years max

#[program]
pub mod vesting_sale {
    use super::*;

    /// Initialize the sale with vesting parameters and price
    pub fn initialize_sale(
        ctx: Context<InitializeSale>,
        cliff_duration: i64,
        vesting_duration: i64,
        usdc_price_per_vect: u64, // Price in USDC (with 6 decimals)
    ) -> Result<()> {
        let sale_state = &mut ctx.accounts.sale_state;
        
        // Validate parameters
        require!(cliff_duration > 0, ErrorCode::InvalidCliffDuration);
        require!(cliff_duration <= MAX_CLIFF_DURATION, ErrorCode::InvalidCliffDuration);
        require!(vesting_duration > 0, ErrorCode::InvalidVestingDuration);
        require!(vesting_duration <= MAX_VESTING_DURATION, ErrorCode::InvalidVestingDuration);
        require!(usdc_price_per_vect > 0, ErrorCode::InvalidPrice);
        
        // Validate mint decimals
        require!(
            ctx.accounts.vect_mint.decimals == VECT_DECIMALS as u8,
            ErrorCode::InvalidMintDecimals
        );
        require!(
            ctx.accounts.usdc_mint.decimals == USDC_DECIMALS as u8,
            ErrorCode::InvalidMintDecimals
        );
        
        sale_state.authority = ctx.accounts.authority.key();
        sale_state.vect_mint = ctx.accounts.vect_mint.key();
        sale_state.usdc_mint = ctx.accounts.usdc_mint.key();
        sale_state.vect_vault = ctx.accounts.vect_vault.key();
        sale_state.usdc_treasury = ctx.accounts.usdc_treasury.key();
        
        sale_state.cliff_duration = cliff_duration;
        sale_state.vesting_duration = vesting_duration;
        sale_state.usdc_price_per_vect = usdc_price_per_vect;
        
        sale_state.total_vect_sold = 0;
        sale_state.total_usdc_raised = 0;
        sale_state.is_paused = false;
        sale_state.is_ended = false;
        sale_state.bump = ctx.bumps.sale_state;
        
        msg!("Sale initialized with price: {} USDC per VECT", usdc_price_per_vect);
        msg!("Cliff: {} seconds, Vesting: {} seconds", cliff_duration, vesting_duration);
        
        Ok(())
    }

    /// Admin funds the VECT vault with tokens for sale
    pub fn admin_fund_vault(
        ctx: Context<AdminFundVault>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        
        // Transfer VECT tokens from admin to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.admin_vect_account.to_account_info(),
            to: ctx.accounts.vect_vault.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        token::transfer(cpi_ctx, amount)?;
        
        msg!("Vault funded with {} VECT tokens", amount);
        Ok(())
    }

    /// Buy VECT tokens with USDC
    pub fn buy_with_usdc(
        ctx: Context<BuyWithUsdc>,
        usdc_amount: u64,
    ) -> Result<()> {
        let sale_state = &mut ctx.accounts.sale_state;
        let clock = Clock::get()?;
        
        // Check sale status
        require!(!sale_state.is_paused, ErrorCode::SaleIsPaused);
        require!(!sale_state.is_ended, ErrorCode::SaleHasEnded);
        
        // Validate minimum purchase
        require!(usdc_amount >= MIN_PURCHASE_USDC, ErrorCode::BelowMinimumPurchase);
        
        // Calculate VECT amount with proper decimal handling
        // Formula: vect_amount = (usdc_amount * 10^VECT_DECIMALS) / usdc_price_per_vect
        let vect_amount = calculate_vect_amount(
            usdc_amount,
            sale_state.usdc_price_per_vect,
        )?;
        
        require!(vect_amount > 0, ErrorCode::InvalidAmount);
        
        // Check vault has enough tokens
        require!(
            ctx.accounts.vect_vault.amount >= vect_amount,
            ErrorCode::InsufficientVaultBalance
        );
        
        // Update state BEFORE external CPI (checks-effects-interactions pattern)
        let vesting = &mut ctx.accounts.vesting;
        
        if vesting.beneficiary == Pubkey::default() {
            // Initialize new vesting
            vesting.beneficiary = ctx.accounts.buyer.key();
            vesting.sale_state = sale_state.key();
            vesting.total_vect_amount = vect_amount;
            vesting.claimed_amount = 0;
            vesting.start_time = clock.unix_timestamp;
            vesting.bump = ctx.bumps.vesting;
        } else {
            // Add to existing vesting - keep original start_time
            vesting.total_vect_amount = vesting.total_vect_amount
                .checked_add(vect_amount)
                .ok_or(ErrorCode::MathOverflow)?;
        }
        
        // Update sale statistics
        sale_state.total_vect_sold = sale_state.total_vect_sold
            .checked_add(vect_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        sale_state.total_usdc_raised = sale_state.total_usdc_raised
            .checked_add(usdc_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        
        // Transfer USDC from buyer to treasury (AFTER state updates)
        let cpi_accounts = Transfer {
            from: ctx.accounts.buyer_usdc_account.to_account_info(),
            to: ctx.accounts.usdc_treasury.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        token::transfer(cpi_ctx, usdc_amount)?;
        
        msg!("Purchased {} VECT with {} USDC", vect_amount, usdc_amount);
        
        Ok(())
    }

    /// Claim vested tokens according to the schedule
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let vesting = &mut ctx.accounts.vesting;
        let sale_state = &ctx.accounts.sale_state;
        let clock = Clock::get()?;
        
        // Calculate elapsed time since vesting start
        let elapsed = clock.unix_timestamp
            .checked_sub(vesting.start_time)
            .ok_or(ErrorCode::MathOverflow)?;
        
        require!(elapsed >= sale_state.cliff_duration, ErrorCode::CliffNotReached);
        
        // Calculate vested amount
        let vested_amount = if elapsed >= sale_state.cliff_duration + sale_state.vesting_duration {
            // Fully vested - give all remaining to avoid rounding dust
            vesting.total_vect_amount
        } else {
            // Linear vesting after cliff
            let vesting_elapsed = elapsed - sale_state.cliff_duration;
            let vested = (vesting.total_vect_amount as u128)
                .checked_mul(vesting_elapsed as u128)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(sale_state.vesting_duration as u128)
                .ok_or(ErrorCode::MathOverflow)?;
            u64::try_from(vested).map_err(|_| ErrorCode::MathOverflow)?
        };
        
        // Calculate claimable amount
        let claimable = vested_amount
            .checked_sub(vesting.claimed_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        
        require!(claimable > 0, ErrorCode::NothingToClaim);
        
        // Update claimed amount BEFORE transfer
        vesting.claimed_amount = vesting.claimed_amount
            .checked_add(claimable)
            .ok_or(ErrorCode::MathOverflow)?;
        
        // Transfer tokens from vault to beneficiary using PDA signer
        let seeds = &[
            b"sale",
            sale_state.authority.as_ref(),
            &[sale_state.bump],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.vect_vault.to_account_info(),
            to: ctx.accounts.beneficiary_vect_account.to_account_info(),
            authority: ctx.accounts.sale_state.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        
        token::transfer(cpi_ctx, claimable)?;
        
        msg!("Claimed {} VECT tokens (Total claimed: {}/{})", 
            claimable, vesting.claimed_amount, vesting.total_vect_amount);
        
        Ok(())
    }

    /// Admin withdraws USDC from treasury
    pub fn withdraw_usdc(
        ctx: Context<WithdrawUsdc>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        
        // Transfer USDC from treasury to authority
        let authority_key = ctx.accounts.authority.key();
        let seeds = &[
            b"sale",
            authority_key.as_ref(),
            &[ctx.accounts.sale_state.bump],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.usdc_treasury.to_account_info(),
            to: ctx.accounts.authority_usdc_account.to_account_info(),
            authority: ctx.accounts.sale_state.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        
        token::transfer(cpi_ctx, amount)?;
        
        msg!("Withdrew {} USDC", amount);
        Ok(())
    }

    /// Admin pauses the sale
    pub fn pause_sale(ctx: Context<UpdateSaleState>) -> Result<()> {
        let sale_state = &mut ctx.accounts.sale_state;
        require!(!sale_state.is_paused, ErrorCode::SaleAlreadyPaused);
        require!(!sale_state.is_ended, ErrorCode::SaleHasEnded);
        
        sale_state.is_paused = true;
        msg!("Sale paused");
        Ok(())
    }

    /// Admin unpauses the sale
    pub fn unpause_sale(ctx: Context<UpdateSaleState>) -> Result<()> {
        let sale_state = &mut ctx.accounts.sale_state;
        require!(sale_state.is_paused, ErrorCode::SaleNotPaused);
        require!(!sale_state.is_ended, ErrorCode::SaleHasEnded);
        
        sale_state.is_paused = false;
        msg!("Sale unpaused");
        Ok(())
    }

    /// Admin ends the sale permanently
    pub fn end_sale(ctx: Context<UpdateSaleState>) -> Result<()> {
        let sale_state = &mut ctx.accounts.sale_state;
        require!(!sale_state.is_ended, ErrorCode::SaleAlreadyEnded);
        
        sale_state.is_ended = true;
        sale_state.is_paused = false; // Clear paused state when ending
        msg!("Sale ended permanently");
        Ok(())
    }

    /// Admin updates the price
    pub fn update_price(
        ctx: Context<UpdateSaleState>,
        new_usdc_price_per_vect: u64,
    ) -> Result<()> {
        let sale_state = &mut ctx.accounts.sale_state;
        require!(new_usdc_price_per_vect > 0, ErrorCode::InvalidPrice);
        
        let old_price = sale_state.usdc_price_per_vect;
        sale_state.usdc_price_per_vect = new_usdc_price_per_vect;
        
        msg!("Price updated from {} to {} USDC per VECT", old_price, new_usdc_price_per_vect);
        Ok(())
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Calculate VECT amount from USDC amount with proper decimal handling
fn calculate_vect_amount(usdc_amount: u64, usdc_price_per_vect: u64) -> Result<u64> {
    // Formula: vect_amount = (usdc_amount * 10^VECT_DECIMALS) / usdc_price_per_vect
    // Example: 10 USDC (10_000_000 with 6 decimals) at price 50_000 (0.05 USDC)
    // = (10_000_000 * 1_000_000_000) / 50_000 = 200_000_000_000 (200 VECT with 9 decimals)
    
    let decimals_multiplier = 10_u128.pow(VECT_DECIMALS);
    let vect_amount = (usdc_amount as u128)
        .checked_mul(decimals_multiplier)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(usdc_price_per_vect as u128)
        .ok_or(ErrorCode::MathOverflow)?;
    
    u64::try_from(vect_amount).map_err(|_| ErrorCode::MathOverflow.into())
}

// ============================================================================
// Account Structures
// ============================================================================

#[derive(Accounts)]
pub struct InitializeSale<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + SaleState::INIT_SPACE,
        seeds = [b"sale", authority.key().as_ref()],
        bump
    )]
    pub sale_state: Account<'info, SaleState>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub vect_mint: Account<'info, Mint>,
    pub usdc_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = authority,
        token::mint = vect_mint,
        token::authority = sale_state,
        seeds = [b"vect_vault", sale_state.key().as_ref()],
        bump
    )]
    pub vect_vault: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = authority,
        token::mint = usdc_mint,
        token::authority = sale_state,
        seeds = [b"usdc_treasury", sale_state.key().as_ref()],
        bump
    )]
    pub usdc_treasury: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AdminFundVault<'info> {
    #[account(
        seeds = [b"sale", authority.key().as_ref()],
        bump = sale_state.bump,
        has_one = authority,
    )]
    pub sale_state: Account<'info, SaleState>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub admin_vect_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"vect_vault", sale_state.key().as_ref()],
        bump,
    )]
    pub vect_vault: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BuyWithUsdc<'info> {
    #[account(
        mut,
        seeds = [b"sale", sale_state.authority.as_ref()],
        bump = sale_state.bump,
    )]
    pub sale_state: Account<'info, SaleState>,
    
    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + Vesting::INIT_SPACE,
        seeds = [b"vesting", sale_state.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub vesting: Account<'info, Vesting>,
    
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    #[account(mut)]
    pub buyer_usdc_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"usdc_treasury", sale_state.key().as_ref()],
        bump,
    )]
    pub usdc_treasury: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"vect_vault", sale_state.key().as_ref()],
        bump,
    )]
    pub vect_vault: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(
        seeds = [b"sale", sale_state.authority.as_ref()],
        bump = sale_state.bump,
    )]
    pub sale_state: Account<'info, SaleState>,
    
    #[account(
        mut,
        seeds = [b"vesting", sale_state.key().as_ref(), beneficiary.key().as_ref()],
        bump = vesting.bump,
        has_one = beneficiary,
    )]
    pub vesting: Account<'info, Vesting>,
    
    #[account(mut)]
    pub beneficiary: Signer<'info>,
    
    pub vect_mint: Account<'info, Mint>,
    
    #[account(
        init_if_needed,
        payer = beneficiary,
        associated_token::mint = vect_mint,
        associated_token::authority = beneficiary,
    )]
    pub beneficiary_vect_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"vect_vault", sale_state.key().as_ref()],
        bump,
    )]
    pub vect_vault: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawUsdc<'info> {
    #[account(
        seeds = [b"sale", authority.key().as_ref()],
        bump = sale_state.bump,
        has_one = authority,
    )]
    pub sale_state: Account<'info, SaleState>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub authority_usdc_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"usdc_treasury", sale_state.key().as_ref()],
        bump,
    )]
    pub usdc_treasury: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateSaleState<'info> {
    #[account(
        mut,
        seeds = [b"sale", authority.key().as_ref()],
        bump = sale_state.bump,
        has_one = authority,
    )]
    pub sale_state: Account<'info, SaleState>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
}

// ============================================================================
// State Accounts
// ============================================================================

#[account]
#[derive(InitSpace)]
pub struct SaleState {
    pub authority: Pubkey,
    pub vect_mint: Pubkey,
    pub usdc_mint: Pubkey,
    pub vect_vault: Pubkey,
    pub usdc_treasury: Pubkey,
    
    pub cliff_duration: i64,
    pub vesting_duration: i64,
    pub usdc_price_per_vect: u64,
    
    pub total_vect_sold: u64,
    pub total_usdc_raised: u64,
    
    pub is_paused: bool,
    pub is_ended: bool,
    
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Vesting {
    pub beneficiary: Pubkey,
    pub sale_state: Pubkey,
    
    pub total_vect_amount: u64,
    pub claimed_amount: u64,
    pub start_time: i64,
    
    pub bump: u8,
}

// ============================================================================
// Error Codes
// ============================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Math operation overflow")]
    MathOverflow,
    
    #[msg("Invalid amount provided")]
    InvalidAmount,
    
    #[msg("Insufficient balance in vault")]
    InsufficientVaultBalance,
    
    #[msg("Cliff period not reached yet")]
    CliffNotReached,
    
    #[msg("Nothing to claim at this time")]
    NothingToClaim,
    
    #[msg("Invalid cliff duration")]
    InvalidCliffDuration,
    
    #[msg("Invalid vesting duration")]
    InvalidVestingDuration,
    
    #[msg("Invalid price")]
    InvalidPrice,
    
    #[msg("Invalid mint decimals")]
    InvalidMintDecimals,
    
    #[msg("Sale is currently paused")]
    SaleIsPaused,
    
    #[msg("Sale has ended")]
    SaleHasEnded,
    
    #[msg("Sale is already paused")]
    SaleAlreadyPaused,
    
    #[msg("Sale is not paused")]
    SaleNotPaused,
    
    #[msg("Sale has already ended")]
    SaleAlreadyEnded,
    
    #[msg("Purchase amount below minimum (10 USDC)")]
    BelowMinimumPurchase,
}

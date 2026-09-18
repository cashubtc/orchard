//! Small test wallet for CDK's custom payment methods. Commands emit JSON so
//! fixture generation and Playwright can drive real settlement independently.
//! This is test-only: the deterministic wallet seed is public.

use std::{collections::HashMap, env, str::FromStr, sync::Arc};

use anyhow::{bail, Context, Result};
use cdk::{
    amount::SplitTarget,
    nuts::{nut00::ProofsMethods, CurrencyUnit, PaymentMethod},
    wallet::Wallet,
    Amount,
};
use cdk_sqlite::WalletSqliteDatabase;
use serde_json::{json, Value};

/// Read a required positional command argument without accepting an empty value.
fn argument(args: &[String], index: usize) -> Result<&str> {
    args.get(index)
        .map(String::as_str)
        .filter(|value| !value.is_empty())
        .with_context(|| format!("missing argument {index}"))
}

/// Run one wallet operation, preserving its proofs and quote keys between calls.
async fn run() -> Result<Value> {
    let args: Vec<String> = env::args().skip(1).collect();
    let command = argument(&args, 0)?;
    let mint_url = env::var("MINT_URL").context("MINT_URL is required")?;
    let unit = CurrencyUnit::from_str(&env::var("MINT_UNIT").context("MINT_UNIT is required")?)?;
    let method =
        PaymentMethod::from_str(&env::var("MINT_METHOD").context("MINT_METHOD is required")?)?;
    let work_dir = env::var("WALLET_DIR").unwrap_or_else(|_| "/wallet".to_string());
    std::fs::create_dir_all(&work_dir)?;
    let db_path = format!("{work_dir}/wallet.sqlite");
    let localstore = WalletSqliteDatabase::new(db_path.as_str()).await?;
    let wallet = Wallet::new(&mint_url, unit, Arc::new(localstore), [42; 64], None)?;

    match command {
        "mint-quote" => {
            let amount = argument(&args, 1)?.parse::<u64>()?;
            let quote = wallet.mint_quote(method, Some(Amount::from(amount)), None, None).await?;
            Ok(json!({"quote": quote.id, "amount": amount, "request": quote.request}))
        }
        "mint" => {
            let quote_id = argument(&args, 1)?;
            wallet.fetch_mint_quote(quote_id, None).await?;
            let proofs = wallet.mint(quote_id, SplitTarget::default(), None).await?;
            Ok(json!({"quote": quote_id, "amount": u64::from(proofs.total_amount()?)}))
        }
        "swap" => {
            let proofs = wallet.get_unspent_proofs().await?;
            if proofs.is_empty() { bail!("cannot seed a swap without wallet funds"); }
            wallet.swap(None, SplitTarget::default(), proofs, None, false, false).await?;
            Ok(json!({"balance": u64::from(wallet.total_balance().await?)}))
        }
        "melt-quote" => {
            let amount = argument(&args, 1)?.parse::<u64>()?;
            let request = argument(&args, 2)?;
            let quote = wallet.melt_quote(method, request, None, Some(json!({"amount": amount}).to_string())).await?;
            Ok(json!({"quote": quote.id, "amount": u64::from(quote.amount), "fee_reserve": u64::from(quote.fee_reserve)}))
        }
        "melt" => {
            let quote_id = argument(&args, 1)?;
            let result = wallet.prepare_melt(quote_id, HashMap::new()).await?.confirm().await?;
            Ok(json!({"quote": quote_id, "state": result.state().to_string(), "amount": u64::from(result.amount())}))
        }
        "melt-status" => {
            let quote = wallet.check_melt_quote_status(argument(&args, 1)?).await?;
            Ok(json!({"quote": quote.id, "state": quote.state.to_string()}))
        }
        "balance" => Ok(json!({"balance": u64::from(wallet.total_balance().await?)})),
        _ => bail!("unknown command {command}; use mint-quote, mint, swap, melt-quote, melt, melt-status, or balance"),
    }
}

/// Keep diagnostics on stderr and reserve stdout for a single JSON result.
#[tokio::main]
async fn main() -> Result<()> {
    println!("{}", run().await?);
    Ok(())
}

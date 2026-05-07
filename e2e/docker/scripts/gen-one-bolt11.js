#!/usr/bin/env node
// Per-call bolt11 generator for activity-fake.sh on stacks without an LN node.
// Stacks with a real CLN/LND node ask the node directly via lightning-cli/lncli;
// fake-cdk-postgres has neither, so we sign locally with a throwaway privkey.
// Each call uses a fresh privkey + payment_hash so every invoice has a unique
// payment hash — the fake mint backend's idempotency check (code 11000
// "Melt quote already paid or pending") never trips.
//
// Usage: node gen-one-bolt11.js <amount_sats>

const crypto = require('crypto');
const bolt11 = require('bolt11');

const amount_sat = parseInt(process.argv[2], 10);
if (!Number.isFinite(amount_sat) || amount_sat <= 0) {
    console.error('usage: gen-one-bolt11.js <amount_sats>');
    process.exit(1);
}

const priv_key = crypto.randomBytes(32).toString('hex');
const unsigned = bolt11.encode({
    coinType: 'regtest',
    satoshis: amount_sat,
    timestamp: Math.floor(Date.now() / 1000),
    tags: [
        {tagName: 'payment_hash', data: crypto.randomBytes(32).toString('hex')},
        {tagName: 'payment_secret', data: crypto.randomBytes(32).toString('hex')},
        {tagName: 'description', data: `e2e-fake-melt-${amount_sat}`},
    ],
});

process.stdout.write(bolt11.sign(unsigned, priv_key).paymentRequest);

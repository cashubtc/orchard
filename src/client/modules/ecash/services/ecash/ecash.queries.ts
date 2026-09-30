const ECASH_MINT_FIELDS = `
    id
    urls
    name
    pubkey
    icon_url
    units
    is_orchard
    created_at`;

const ECASH_OPERATION_FIELDS = `
    id
    mint_id
    type
    state
    method
    unit
    amount
    memo
    error
    created_at
    updated_at`;

const ECASH_SEED_FIELDS = `
    created_at
    backed_up_at`;

export const ECASH_MINTS_QUERY = `{
    ecash_mints {${ECASH_MINT_FIELDS}
    }
}`;

export const ECASH_BALANCES_QUERY = `{
    ecash_balances {
        mint_id
        unit
        balance
    }
}`;

export const ECASH_MINT_STATUS_QUERY = `{
    ecash_mint_status {
        mint_id
        online
        latency_ms
        error
        checked_at
    }
}`;

export const ECASH_SEED_QUERY = `{
    ecash_seed {${ECASH_SEED_FIELDS}
    }
}`;

export const ECASH_OPERATIONS_DATA_QUERY = `
query EcashOperationsData(
    $units: [String!]
    $mint_ids: [ID!]
    $methods: [String!]
    $states: [WalletOperationState!]
    $types: [WalletOperationType!]
    $date_start: UnixTimestamp
    $date_end: UnixTimestamp
    $page: Int
    $page_size: Int
) {
    ecash_operations(
        units: $units
        mint_ids: $mint_ids
        methods: $methods
        states: $states
        types: $types
        date_start: $date_start
        date_end: $date_end
        page: $page
        page_size: $page_size
    ) {${ECASH_OPERATION_FIELDS}
    }
    ecash_operation_count(
        units: $units
        mint_ids: $mint_ids
        methods: $methods
        states: $states
        types: $types
        date_start: $date_start
        date_end: $date_end
    ) {
        count
    }
}`;

export const ECASH_ISSUE_MUTATION = `
mutation ecash_issue($unit: String!, $amount: Float!, $memo: String) {
    ecash_issue(unit: $unit, amount: $amount, memo: $memo) {${ECASH_OPERATION_FIELDS}
    }
}`;

export const ECASH_MINT_ADD_MUTATION = `
mutation ecash_mint_add($mint_url: String!) {
    ecash_mint_add(mint_url: $mint_url) {${ECASH_MINT_FIELDS}
    }
}`;

export const ECASH_MINT_REMOVE_MUTATION = `
mutation ecash_mint_remove($mint_id: ID!) {
    ecash_mint_remove(mint_id: $mint_id)
}`;

export const ECASH_SEED_REVEAL_MUTATION = `
mutation ecash_seed_reveal($password: String!) {
    ecash_seed_reveal(password: $password)
}`;

export const ECASH_SEED_BACKUP_MUTATION = `
mutation ecash_seed_backup {
    ecash_seed_backup {${ECASH_SEED_FIELDS}
    }
}`;

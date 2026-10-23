#!/bin/sh
# Exercise the same setup RPCs the Orchard wizard will use. Runs inside member1.
set -eu
out=/tmp/ceremony
mkdir -p "$out"

cli() {
    timeout 120 sh /stack/cli.sh "$@"
}

fail() {
    echo "$*; inspect ./e2e/docker/federation/dev.sh logs" >&2
    exit 1
}

# Retry a check every 2s for up to 10 minutes, then fail with its last output.
wait_for() {
    desc="$1"
    shift
    tries=300
    until last="$("$@" 2>&1)"; do
        tries=$((tries - 1))
        [ "$tries" -gt 0 ] || fail "Timed out waiting for $desc: $last"
        sleep 2
    done
}

setup_finalized() {
    cli "$1" federation-setup status --json | jq -e '.dkg.finalized_ready == true'
}

member_running() {
    cli "$1" federation info --json >"$out/info-$1.json" \
        && curl --max-time 10 -fsS "http://localhost:$((3350 + $1))/v1/keysets" >"$out/keysets-$1.json"
}

peers_converged() {
    cli "$1" federation members --json | jq -e '(.members | length) == 3
        and all(.members[]; .reachable and .status.sync.ready)
        and .digest_agreement.state == "converged"
        and (.digest_agreement.compared_members | length) == 3'
}

# Refuse to change an existing ceremony. Reset is an explicit host-side action.
for member in 1 2 3; do
    cli "$member" federation-setup status --json >"$out/status-$member.json"
    jq -e '.initialized == false' "$out/status-$member.json" >/dev/null \
        || fail "Member $member already has a setup; run dev.sh reset for a fresh ceremony"
done

cli 1 federation-setup create --members 3 --threshold 2 --network regtest \
    --output-dir "$out/invitations" --federation-api-url http://127.0.0.1:3351 \
    --allow-insecure-localhost
for member in 2 3; do
    cli "$member" federation-setup join \
        --invitation-file "$out/invitations/member-$member.invite" \
        --federation-api-url "http://127.0.0.1:$((3350 + member))" \
        --allow-insecure-localhost
done
proposal_hash="$(cli 1 federation-setup propose | sed -n 's/^proposal_hash: //p')"
[ -n "$proposal_hash" ] || fail "Propose returned no proposal hash"
for member in 1 2 3; do
    cli "$member" federation-setup review --json >"$out/review-$member.json"
    jq -e --arg hash "$proposal_hash" '.proposal_hash == $hash' "$out/review-$member.json" >/dev/null \
        || fail "Member $member reviewed another proposal"
    cli "$member" federation-setup approve --proposal-hash "$proposal_hash"
done

echo "Waiting for key generation, activation, and convergence..."
for member in 1 2 3; do
    wait_for "member $member key generation" setup_finalized "$member"
done
for member in 1 2 3; do
    cli "$member" federation-setup activate
done
for member in 1 2 3; do
    wait_for "member $member to run as a federation member" member_running "$member"
done

federation_id="$(jq -er '.federation_id | select(length > 0)' "$out/info-1.json")"
config_digest="$(jq -er '.config_digest | select(length > 0)' "$out/info-1.json")"
keysets="$(jq -ec '[.keysets[].id] | sort | select(length > 0)' "$out/keysets-1.json")"
for member in 1 2 3; do
    jq -e --arg id "$federation_id" --arg digest "$config_digest" --argjson member "$member" \
        '.federation_id == $id and .config_digest == $digest and .local_member_id == $member
         and (.members | length) == 3 and .threshold_params.signature_threshold == 2
         and .threshold_params.consensus_threshold == 3' "$out/info-$member.json" >/dev/null \
        || fail "Member $member reports a different federation"
    [ "$(jq -c '[.keysets[].id] | sort' "$out/keysets-$member.json")" = "$keysets" ] \
        || fail "Member $member serves different keysets"
    wait_for "member $member to see all peers converge" peers_converged "$member"
done
echo "PASS: all three members activated federation $federation_id with keysets $keysets"

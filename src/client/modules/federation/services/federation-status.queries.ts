export const FEDERATION_INFO_QUERY = /* GraphQL */ `
	query FederationFederationInfo {
		federation_info {
			federation_id
			local_member_id
			config_digest
			threshold_params {
				member_count
				signature_threshold
				consensus_threshold
			}
			members {
				member_id
				public_mint_url
				federation_api_url
				identity_public_key
			}
			keysets {
				id
				unit
				active
				input_fee_ppk
				final_expiry
			}
			payment_observation_policy {
				mint_quotes {
					kind
					required_observations
				}
				melt_quotes {
					kind
					required_observations
				}
			}
		}
	}
`;

export const FEDERATION_LOCAL_STATUS_QUERY = /* GraphQL */ `
	query FederationLocalStatus {
		federation_local_status {
			status {
				sync {
					state
					ready
					message
					peer_member_id
					local_operation_count
					peer_operation_count
				}
				peer {
					operation_count
					latest_index
					aleph_bft_session
					latest_order_digest
					application_digest
					latest_audited_checkpoint_id
					materialized_state_digest
				}
				queues {
					pending_mempool_items
					pending_response_waiters
					response_cache_items
					response_cache_lookups
					response_cache_hits
					response_cache_hit_rate_bps
					duplicate_submissions
					duplicate_pending_waiter_joins
				}
				consensus {
					live_session_active
					network_inbound_active
					runtime {
						session
						next_item_index
						queued_item_count
						pending_finalization_item_count
						finalized_item_count
						accepted_operation_count
					}
				}
				checkpoint {
					journal_next_index
					finalized_next_item_index
					application_next_index
					audit_mismatch
					trusted_checkpoint_id
					trusted_checkpoint_signers
					trusted_checkpoint_operation_count
					lag_from_trusted_checkpoint
					latest_scheduled_checkpoint_id
					latest_scheduled_quorum_id
					latest_recovery_quorum_id
					active_session_backup {
						session
						chunk_count
						total_bytes
					}
				}
				payment_observations {
					total_reports
					conflicting
					stale
					inspect
					reports {
						context
						quote
						status
						recommended_action
						required
						total_observations
						quote_age_secs
						stale
						conflicting_observers
						competing_terminal_state_observers
						groups {
							state
							observers
							quorum_reached
							terminal_state
						}
					}
					truncated
				}
				invalid_operation_alerts {
					source
					alerting_buckets
					max_count
					threshold
					window_secs
				}
			}
		}
	}
`;

export const FEDERATION_MEMBER_STATUSES_QUERY = /* GraphQL */ `
	query FederationMemberStatuses {
		federation_member_statuses {
			members {
				member_id
				local
				reachable
				latency_ms
				error
				status {
					sync {
						state
					}
					peer {
						operation_count
					}
					checkpoint {
						audit_mismatch
					}
				}
			}
			digest_agreement {
				state
				compared_members
				digest_alert_members
				missing_application_digest_members
				conflicts {
					kind
					first_member_id
					second_member_id
					operation_count
				}
			}
			queried_at_unix
		}
	}
`;

export const FEDERATION_CUSTODY_STATUS_QUERY = /* GraphQL */ `
	query FederationCustodyStatus {
		federation_custody_status {
			onchain_wallets {
				source
				source_scope
				source_id
				correlated_source_warning
				health
				local_tip_height
				local_tip_hash
				last_success_unix
				consecutive_failures
			}
			wallet_operator {
				root_key_epoch
				application_key_epoch
				descriptor_commitment
				network
				minimum_confirmations
				fee_policy_version
				utxos {
					state
					count
					value_sat
				}
				reserved_value_sat
				operation_phases {
					phase
					count
				}
				pending_batches
				signing_attempts
				signing_failures
				broadcast_health
				broadcast_failures
			}
			wallet_recovery {
				payment_intents
				transactions
				sticky_reservations
				actions {
					phase
					state
					action
					count
				}
			}
			wallet_liveness {
				pending_batches
				awaiting_signatures
				proposal_attempts
				signing_attempts
				signer_failures
				activity
			}
			bark {
				readiness
				degraded_reason
				accepted_frontier
				local_frontier
				projection_lag_operations
				network
				chain_tip_height
				vtxos {
					state
					count
					value_sat
				}
				expiring_vtxo_count
				expiring_value_sat
				ambiguous_action_count
				ambiguous_value_sat
				recovery_required_action_count
				recovery_required_value_sat
				signer_retry_action_count
				missing_acknowledged_receive_secrets
				details_json
			}
		}
	}
`;

/* Application Dependencies */
import {SERVICE_STATUS_FIELDS} from '@client/modules/config/services/config.queries';

export const CONFIGURATIONS_QUERY = `query ServiceConfigurations { service_configurations { ${SERVICE_STATUS_FIELDS} fields { key value secret set } } }`;
export const CHECK_FIELDS =
	'ok warning saved title context diagnostic fields chain chain_match mode bitcoin_version bitcoin_blocks mint_member_id mint_member_count';
export const TEST_MUTATION = `mutation TestService($input: ServiceConnectionInput!) { service_connection_test(input: $input) { ${CHECK_FIELDS} } }`;
export const SAVE_MUTATION = `mutation SaveService($input: ServiceConnectionInput!, $save_unreachable: Boolean!) { service_configuration_save(input: $input, save_unreachable: $save_unreachable) { ${CHECK_FIELDS} } }`;
export const REMOVE_MUTATION = `mutation RemoveService($service: ServiceKind!) { service_configuration_remove(service: $service) }`;

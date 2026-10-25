export const SERVICE_STATUS_FIELDS = 'service enabled type source status database public_api database_type metrics';
export const SERVICE_STATUS_QUERY = `query ServiceStatus { service_status { ${SERVICE_STATUS_FIELDS} } }`;

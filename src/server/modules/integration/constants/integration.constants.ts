// Bounds a call to a node or mint so a hung backend can't stall a save; generous for large pages over slow links
export const INTEGRATION_REQUEST_TIMEOUT_MS = 60000;

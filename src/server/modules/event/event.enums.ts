export enum EventLogActorType {
	USER = 'user',
	SYSTEM = 'system',
	AGENT = 'agent',
}

export enum EventLogSection {
	BITCOIN = 'bitcoin',
	LIGHTNING = 'lightning',
	MINT = 'mint',
	ECASH = 'ecash',
	AI = 'ai',
	SETTINGS = 'settings',
}

export enum EventLogEntityType {
	INFO = 'info',
	QUOTE = 'quote',
	QUOTE_TTL = 'quote_ttl',
	NUT04 = 'nut04',
	NUT05 = 'nut05',
	KEYSET = 'keyset',
	DATABASE = 'database',
	SETTING = 'setting',
	AGENT = 'agent',
	ECASH = 'ecash',
}

export enum EventLogType {
	CREATE = 'create',
	UPDATE = 'update',
	DELETE = 'delete',
	EXECUTE = 'execute',
}

export enum EventLogStatus {
	SUCCESS = 'success',
	PARTIAL = 'partial',
	ERROR = 'error',
}

export enum EventLogDetailStatus {
	SUCCESS = 'success',
	ERROR = 'error',
}

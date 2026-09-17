export const UpdateMintEnabledTool = {
	type: 'function',
	function: {
		name: 'MINT_ENABLED_UPDATE',
		description: 'This tool allows you to update the enabled status of the minting and melting operations.',
		parameters: {
			type: 'object',
			properties: {
				enabled: {
					type: 'boolean',
					description: 'The enabled status of the chosen operation',
				},
				operation: {
					type: 'string',
					enum: ['minting', 'melting'],
					description: 'The operation to update the enabled status of',
				},
			},
			required: ['enabled', 'operation'],
		},
	},
};

export const UpdateMintQuoteTtlTool = {
	type: 'function',
	function: {
		name: 'MINT_QUOTE_TTL_UPDATE',
		description: 'This tool allows you to update quote ttls for the minting and melting operations.',
		parameters: {
			type: 'object',
			properties: {
				ttl: {
					type: 'number',
					description: 'The quote ttl of the mint in seconds',
				},
				operation: {
					type: 'string',
					enum: ['minting', 'melting'],
					description: 'The operation to update the quote ttl of',
				},
			},
			required: ['ttl', 'operation'],
		},
	},
};

export const UpdateMintMethodMinTool = {
	type: 'function',
	function: {
		name: 'MINT_METHOD_MIN_UPDATE',
		description: 'This tool allows you to update the minimum amount of a method for the minting and melting operations.',
		parameters: {
			type: 'object',
			properties: {
				min_amount: {
					type: 'number',
					description: 'The minimum amount of the method',
				},
				operation: {
					type: 'string',
					enum: ['minting', 'melting'],
					description: 'The operation to update the minimum amount of',
				},
				method: {
					type: 'string',
					description: 'A payment method advertised by this mint, as listed in mint_info',
				},
				unit: {
					type: 'string',
					description: 'A unit advertised by this mint, as listed in mint_keysets',
				},
			},
			required: ['min_amount', 'operation', 'method', 'unit'],
		},
	},
};

export const UpdateMintMethodMaxTool = {
	type: 'function',
	function: {
		name: 'MINT_METHOD_MAX_UPDATE',
		description: 'This tool allows you to update the maximum amount of a method for the minting and melting operations.',
		parameters: {
			type: 'object',
			properties: {
				max_amount: {
					type: 'number',
					description: 'The maximum amount of the method',
				},
				operation: {
					type: 'string',
					enum: ['minting', 'melting'],
					description: 'The operation to update the maximum amount of',
				},
				method: {
					type: 'string',
					description: 'A payment method advertised by this mint, as listed in mint_info',
				},
				unit: {
					type: 'string',
					description: 'A unit advertised by this mint, as listed in mint_keysets',
				},
			},
			required: ['max_amount', 'operation', 'method', 'unit'],
		},
	},
};

export const UpdateMintMethodDescriptionTool = {
	type: 'function',
	function: {
		name: 'MINT_METHOD_DESCRIPTION_UPDATE',
		description:
			'This tool allows you to update the boolean flag to signal support for descriptions in a specific minting method and unit.',
		parameters: {
			type: 'object',
			properties: {
				description: {
					type: 'boolean',
					description: 'The boolean flag to signal support for descriptions in a minting method',
				},
				method: {
					type: 'string',
					enum: ['bolt11'],
					description: 'The method to update the description status of. Descriptions are a bolt11-only mint method option.',
				},
				unit: {
					type: 'string',
					description: 'A unit advertised by this mint, as listed in mint_keysets',
				},
			},
			required: ['description', 'method', 'unit'],
		},
	},
};

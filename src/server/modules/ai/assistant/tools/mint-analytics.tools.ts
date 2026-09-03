export const UpdateMintAnalyticsUnitsTool = {
	type: 'function',
	function: {
		name: 'MINT_ANALYTICS_UNITS_UPDATE',
		description: 'This tool allows you to update the units displayed in the mint analytics.',
		parameters: {
			type: 'object',
			properties: {
				units: {
					type: 'array',
					description: 'Units advertised by this mint, as listed in mint_keysets',
					items: {
						type: 'string',
					},
				},
			},
			required: ['units'],
		},
	},
};

export const UpdateMintAnalyticsIntervalTool = {
	type: 'function',
	function: {
		name: 'MINT_ANALYTICS_INTERVAL_UPDATE',
		description:
			'This tool allows you to update the interval of the mint analytics. Only use this when asked to change the interval of the mint analytics.',
		parameters: {
			type: 'object',
			properties: {
				interval: {
					type: 'string',
					description: 'The interval of the mint analytics',
					enum: ['day', 'week', 'month'],
				},
			},
			required: ['interval'],
		},
	},
};

export const UpdateMintAnalyticsTypeTool = {
	type: 'function',
	function: {
		name: 'MINT_ANALYTICS_TYPE_UPDATE',
		description: 'This tool allows you to update the type of the mint analytics.',
		parameters: {
			type: 'object',
			properties: {
				type: {
					type: 'string',
					description: 'The type of the mint analytics',
					enum: ['summary', 'volume', 'operations'],
				},
			},
			required: ['type'],
		},
	},
};

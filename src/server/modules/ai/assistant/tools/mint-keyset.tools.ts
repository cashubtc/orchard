export const UpdateMintKeysetStatusTool = {
	type: 'function',
	function: {
		name: 'MINT_KEYSET_STATUS_UPDATE',
		description: 'This tool allows you to filter the keysets by status.',
		parameters: {
			type: 'object',
			properties: {
				statuses: {
					type: 'array',
					description: 'The status types of the keysets to filter by',
					items: {
						type: 'boolean',
						enum: ['true', 'false'],
					},
				},
			},
			required: ['statuses'],
		},
	},
};

export const UpdateMintKeysetRotationUnitTool = {
	type: 'function',
	function: {
		name: 'MINT_KEYSET_ROTATION_UNIT_UPDATE',
		description: 'This tool allows you to update the unit of the keyset rotation.',
		parameters: {
			type: 'object',
			properties: {
				unit: {
					type: 'string',
					enum: ['sat', 'usd', 'eur'],
					description: 'The unit of the method',
				},
			},
			required: ['unit'],
		},
	},
};

export const UpdateMintKeysetRotationInputFeePpkTool = {
	type: 'function',
	function: {
		name: 'MINT_KEYSET_ROTATION_INPUT_FEE_PPK_UPDATE',
		description: 'This tool allows you to update the input fee ppk of the keyset rotation.',
		parameters: {
			type: 'object',
			properties: {
				input_fee_ppk: {
					type: 'number',
					description: 'The input fee ppk of the keyset rotation',
				},
			},
			required: ['input_fee_ppk'],
		},
	},
};

export const UpdateMintKeysetRotationAmountsTool = {
	type: 'function',
	function: {
		name: 'MINT_KEYSET_ROTATION_AMOUNTS_UPDATE',
		description: 'This tool allows you to update the ecash denomination amounts of the keyset rotation.',
		parameters: {
			type: 'object',
			properties: {
				amounts: {
					type: 'array',
					items: {type: 'number'},
					description: 'The ecash denomination amounts for the keyset rotation',
				},
			},
			required: ['amounts'],
		},
	},
};

export const UpdateMintKeysetRotationFinalExpiryTool = {
	type: 'function',
	function: {
		name: 'MINT_KEYSET_ROTATION_FINAL_EXPIRY_UPDATE',
		description: 'Update the final expiry date of the keyset rotation. The keyset expires at the end of this day.',
		parameters: {
			type: 'object',
			properties: {
				final_expiry: {type: 'string', description: 'The final expiry date, in the format YYYY-MM-DD'},
			},
			required: ['final_expiry'],
		},
	},
};

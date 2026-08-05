export const UpdateMintDatabaseDataTypeTool = {
	type: 'function',
	function: {
		name: 'MINT_DATABASE_DATA_TYPE_UPDATE',
		description: 'This tool allows you to change what type of data is being displayed.',
		parameters: {
			type: 'object',
			properties: {
				type: {
					type: 'string',
					enum: ['MintMints', 'MintMelts', 'MintSwaps'],
					description: 'The type of data to display.',
				},
			},
			required: ['type'],
		},
	},
};

export const UpdateMintDatabaseStatesTool = {
	type: 'function',
	function: {
		name: 'MINT_DATABASE_STATES_UPDATE',
		description: 'This tool allows you to change what states are being displayed for the selected data type.',
		parameters: {
			type: 'object',
			properties: {
				states: {
					type: 'array',
					description:
						'The states to display for the selected data type. The valid states for MintMints are: ISSUED, PAID, PENDING, UNPAID. The valid states for MintMelts are: PAID, PENDING, UNPAID.',
					items: {
						type: 'string',
						enum: ['ISSUED', 'PAID', 'PENDING', 'UNPAID'],
					},
				},
			},
			required: ['states'],
		},
	},
};

export const UpdateMintBackupFilenameTool = {
	type: 'function',
	function: {
		name: 'MINT_BACKUP_FILENAME_UPDATE',
		description: 'This tool allows you to update the filename of the backup.',
		parameters: {
			type: 'object',
			properties: {
				filename: {
					type: 'string',
					description: 'The filename of the backup',
				},
			},
			required: ['filename'],
		},
	},
};

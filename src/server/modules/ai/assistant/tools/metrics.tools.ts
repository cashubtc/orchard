export const UpdateMetricsIntervalTool = {
	type: 'function',
	function: {
		name: 'METRICS_INTERVAL_UPDATE',
		description:
			'This tool allows you to update the interval of the metrics. Only use this when asked to change the interval of the metrics.',
		parameters: {
			type: 'object',
			properties: {
				interval: {
					type: 'string',
					description: 'The interval of the metrics',
					enum: ['minute', 'hour', 'day'],
				},
			},
			required: ['interval'],
		},
	},
};

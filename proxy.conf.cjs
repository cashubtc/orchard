require('dotenv').config({ path: '.env', quiet: true });

module.exports = {
	"/proxy": {
		target: (() => {
			const server_host = process.env.SERVER_HOST || 'localhost';
			const formatted_host = server_host && (server_host.startsWith('http://') || server_host.startsWith('https://')) 
				? server_host 
				: `http://${server_host}`;
			return `${formatted_host}:${process.env.SERVER_PORT || '3321'}`;
		})(),
		"pathRewrite": {"^/proxy": ""},
		"secure": false,
		"ws": true,
	}
}
/* Vendor Dependencies */
import {DataSource} from 'typeorm';
/* Application Dependencies */
import {User} from '../modules/user/user.entity.js';
import {Invite} from '../modules/invite/invite.entity.js';
import {TokenBlacklist} from '../modules/auth/token-blacklist.entity.js';
import {Setting} from '../modules/setting/setting.entity.js';
import {UTXOracle} from '../modules/bitcoin/utxoracle/utxoracle.entity.js';
import {AnalyticsCheckpoint} from '../modules/analytics/analytics-checkpoint.entity.js';
import {LightningAnalytics} from '../modules/lightning/analytics/lnanalytics.entity.js';
import {MintAnalytics} from '../modules/cashu/mintanalytics/mintanalytics.entity.js';
import {EventLog} from '../modules/event/event.entity.js';
import {EventLogDetail} from '../modules/event/event-detail.entity.js';
import {Agent} from '../modules/ai/agent/agent.entity.js';
import {AgentRun} from '../modules/ai/agent/agent-run.entity.js';
import {Conversation} from '../modules/ai/conversation/conversation.entity.js';
import {BitcoinAnalytics} from '../modules/bitcoin/analytics/btcanalytics.entity.js';
import {SystemMetrics} from '../modules/system/metrics/sysmetrics.entity.js';
import {MintMetrics} from '../modules/cashu/mintmetrics/mintmetrics.entity.js';
/* Local Dependencies */
import * as migrations from './migrations/index.js';

export const AppDataSource = new DataSource({
	type: 'better-sqlite3',
	database: process.env.DATABASE_DIR ? `${process.env.DATABASE_DIR}/orchard.db` : 'data/orchard.db',
	entities: [
		User,
		Invite,
		TokenBlacklist,
		Setting,
		UTXOracle,
		AnalyticsCheckpoint,
		LightningAnalytics,
		MintAnalytics,
		BitcoinAnalytics,
		EventLog,
		EventLogDetail,
		Agent,
		AgentRun,
		Conversation,
		SystemMetrics,
		MintMetrics,
	],
	migrations: Object.values(migrations),
	synchronize: false,
});

/* Core Dependencies */
import {Field, Int, Float, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import type {BitcoinBlockchainInfo} from '#server/modules/bitcoin/rpc/btcrpc.types';

@ObjectType({description: 'Bitcoin block count'})
export class OrchardBitcoinBlockCount {
	@Field(() => Int, {description: 'Current block height'})
	height: number;

	constructor(height: number) {
		this.height = height;
	}
}
@ObjectType({description: 'Bitcoin blockchain information'})
export class OrchardBitcoinBlockchainInfo {
	@Field(() => String, {description: 'Name of the active chain (main, test, regtest)'})
	chain: string;

	@Field(() => Int, {description: 'Number of validated blocks'})
	blocks: number;

	@Field(() => Int, {description: 'Number of headers received'})
	headers: number;

	@Field(() => String, {description: 'Hash of the best known block'})
	bestblockhash: string;

	@Field(() => Float, {description: 'Current mining difficulty'})
	difficulty: number;

	@Field(() => Float, {description: 'Chain verification progress estimate'})
	verificationprogress: number;

	@Field(() => Boolean, {description: 'Whether the initial block download is in progress'})
	initialblockdownload: boolean;

	@Field(() => String, {description: 'Cumulative chainwork in hex'})
	chainwork: string;

	@Field(() => Float, {description: 'Blockchain data size on disk in bytes'})
	size_on_disk: number;

	@Field(() => Boolean, {description: 'Whether pruning is enabled'})
	pruned: boolean;

	@Field(() => Int, {nullable: true, description: 'Lowest block height stored when pruned'})
	pruneheight: number;

	@Field(() => Boolean, {nullable: true, description: 'Whether automatic pruning is enabled'})
	automatic_pruning: boolean;

	@Field(() => Float, {nullable: true, description: 'Target size for pruning in bytes'})
	prune_target_size: number;

	@Field(() => [String], {description: 'Active network warnings'})
	warnings: string[];

	constructor(obi: BitcoinBlockchainInfo) {
		this.chain = obi.chain;
		this.blocks = obi.blocks;
		this.headers = obi.headers;
		this.bestblockhash = obi.bestblockhash;
		this.difficulty = obi.difficulty;
		this.verificationprogress = obi.verificationprogress;
		this.initialblockdownload = obi.initialblockdownload;
		this.chainwork = obi.chainwork;
		this.size_on_disk = obi.size_on_disk;
		this.pruned = obi.pruned;
		this.pruneheight = obi.pruneheight;
		this.automatic_pruning = obi.automatic_pruning;
		this.prune_target_size = obi.prune_target_size;
		this.warnings = Array.isArray(obi.warnings) ? obi.warnings : [obi.warnings];
	}
}

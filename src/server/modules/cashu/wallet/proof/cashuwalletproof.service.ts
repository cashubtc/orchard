/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {Repository} from 'typeorm';
/* Local Dependencies */
import {CashuWalletProof} from './cashuwalletproof.entity.js';
import {WalletProofState} from '../cashuwallet.enums.js';
import type {CashuWalletBalance} from '../cashuwallet.types.js';

@Injectable()
export class CashuWalletProofService {
	constructor(
		@InjectRepository(CashuWalletProof)
		private walletProofRepository: Repository<CashuWalletProof>,
	) {}

	/* *******************************************************
		Balances
	******************************************************** */

	/** Sum a user's ready proofs by mint and unit */
	public async getBalances(user_id: string): Promise<CashuWalletBalance[]> {
		const rows = await this.walletProofRepository
			.createQueryBuilder('proof')
			.select('proof.mint_id', 'mint_id')
			.addSelect('proof.unit', 'unit')
			.addSelect('SUM(proof.amount)', 'balance')
			.where('proof.user_id = :user_id', {user_id})
			.andWhere('proof.state = :state', {state: WalletProofState.READY})
			.groupBy('proof.mint_id')
			.addGroupBy('proof.unit')
			.getRawMany<CashuWalletBalance>();
		return rows.map((row) => ({...row, balance: Number(row.balance)}));
	}
}

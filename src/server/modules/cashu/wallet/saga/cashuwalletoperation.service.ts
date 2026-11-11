/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {Between, In, Repository, type FindOptionsWhere} from 'typeorm';
/* Native Dependencies */
import {walletError} from '#server/modules/cashu/wallet/cashuwallet.helpers';
import type {CashuWalletOperationFilters} from '#server/modules/cashu/wallet/cashuwallet.types';
/* Local Dependencies */
import {CashuWalletOperation} from './cashuwalletoperation.entity.js';

@Injectable()
export class CashuWalletOperationService {
	constructor(
		@InjectRepository(CashuWalletOperation)
		private walletOperationRepository: Repository<CashuWalletOperation>,
	) {}

	/* *******************************************************
		History
	******************************************************** */

	/** A user's operations matching the filters, newest first; paged when page and page_size are both given */
	public listOperations(user_id: string, filters: CashuWalletOperationFilters = {}): Promise<CashuWalletOperation[]> {
		const {page, page_size} = filters;
		return this.walletOperationRepository.find({
			where: this.operationConditions(user_id, filters),
			order: {created_at: 'DESC', id: 'DESC'},
			...(page !== undefined && page_size !== undefined && {skip: page * page_size, take: page_size}),
		});
	}

	/** One of a user's operations */
	public async getOperation(user_id: string, operation_id: string): Promise<CashuWalletOperation> {
		const operation = await this.walletOperationRepository.findOneBy({id: operation_id, user_id});
		if (!operation) throw walletError('Operation not found');
		return operation;
	}

	/** The token one of a user's sends carries */
	public async getToken(user_id: string, operation_id: string): Promise<string> {
		const {token} = await this.getOperation(user_id, operation_id);
		if (!token) throw walletError('This operation has no token');
		return token;
	}

	/** Number of a user's operations matching the filters, ignoring paging */
	public countOperations(user_id: string, filters: CashuWalletOperationFilters = {}): Promise<number> {
		return this.walletOperationRepository.count({where: this.operationConditions(user_id, filters)});
	}

	/** Shared conditions for listing and counting a user's operations */
	private operationConditions(user_id: string, filters: CashuWalletOperationFilters): FindOptionsWhere<CashuWalletOperation> {
		const where: FindOptionsWhere<CashuWalletOperation> = {user_id};
		if (filters.units?.length) where.unit = In(filters.units);
		if (filters.mint_ids?.length) where.mint_id = In(filters.mint_ids);
		if (filters.methods?.length) where.method = In(filters.methods);
		if (filters.states?.length) where.state = In(filters.states);
		if (filters.types?.length) where.type = In(filters.types);
		if (filters.date_start !== undefined || filters.date_end !== undefined) {
			where.created_at = Between(filters.date_start ?? 0, filters.date_end ?? Number.MAX_SAFE_INTEGER);
		}
		return where;
	}
}

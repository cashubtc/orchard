/* Core Dependencies */
import {Logger, UseInterceptors} from '@nestjs/common';
import {Resolver, Query, Mutation, Args, Context, Float, Int, ID} from '@nestjs/graphql';
/* Application Dependencies */
import {Roles} from '#server/modules/auth/decorators/auth.decorator';
import {UserRole} from '#server/modules/user/user.enums';
import {normalizeMintUnit, normalizeMintUnits} from '#server/modules/cashu/cashu.helpers';
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import {OrchardCommonCount} from '#server/modules/api/common/entity-count.model';
import {WalletOperationState, WalletOperationType} from '#server/modules/cashu/wallet/cashuwallet.enums';
import {LogEvent} from '#server/modules/event/event.decorator';
import {EventLogType} from '#server/modules/event/event.enums';
/* Local Dependencies */
import {EcashOperationService} from './ecashoperation.service.js';
import {OrchardEcashOperation} from './ecashoperation.model.js';
import {EcashOperationInterceptor} from './ecashoperation.interceptor.js';

@Resolver()
export class EcashOperationResolver {
	private readonly logger = new Logger(EcashOperationResolver.name);

	constructor(private ecashOperationService: EcashOperationService) {}

	@Query(() => [OrchardEcashOperation], {description: "List the current user's ecash wallet operations with optional filters"})
	async ecash_operations(
		@Context() context: any,
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'}) date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('units', {type: () => [String], nullable: true, description: 'Filter by units'}) units?: string[],
		@Args('mint_ids', {type: () => [ID], nullable: true, description: 'Filter by wallet mint identifiers'}) mint_ids?: string[],
		@Args('methods', {type: () => [String], nullable: true, description: 'Filter by payment methods'}) methods?: string[],
		@Args('states', {type: () => [WalletOperationState], nullable: true, description: 'Filter by operation states'})
		states?: WalletOperationState[],
		@Args('types', {type: () => [WalletOperationType], nullable: true, description: 'Filter by operation types'})
		types?: WalletOperationType[],
		@Args('page', {type: () => Int, nullable: true, description: 'Page number for pagination'}) page?: number,
		@Args('page_size', {type: () => Int, nullable: true, description: 'Number of results per page'}) page_size?: number,
	): Promise<OrchardEcashOperation[]> {
		const tag = 'GET { ecash_operations }';
		this.logger.debug(tag);
		return await this.ecashOperationService.getEcashOperations(tag, context.req.user.id, {
			date_start,
			date_end,
			units: normalizeMintUnits(units),
			mint_ids,
			methods,
			states,
			types,
			page,
			page_size,
		});
	}

	@Query(() => OrchardCommonCount, {description: "Get the count of the current user's ecash wallet operations matching filters"})
	async ecash_operation_count(
		@Context() context: any,
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'}) date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('units', {type: () => [String], nullable: true, description: 'Filter by units'}) units?: string[],
		@Args('mint_ids', {type: () => [ID], nullable: true, description: 'Filter by wallet mint identifiers'}) mint_ids?: string[],
		@Args('methods', {type: () => [String], nullable: true, description: 'Filter by payment methods'}) methods?: string[],
		@Args('states', {type: () => [WalletOperationState], nullable: true, description: 'Filter by operation states'})
		states?: WalletOperationState[],
		@Args('types', {type: () => [WalletOperationType], nullable: true, description: 'Filter by operation types'})
		types?: WalletOperationType[],
	): Promise<OrchardCommonCount> {
		const tag = 'GET { ecash_operation_count }';
		this.logger.debug(tag);
		return await this.ecashOperationService.getEcashOperationCount(tag, context.req.user.id, {
			date_start,
			date_end,
			units: normalizeMintUnits(units),
			mint_ids,
			methods,
			states,
			types,
		});
	}

	@Roles(UserRole.ADMIN)
	@UseInterceptors(EcashOperationInterceptor)
	@LogEvent({type: EventLogType.CREATE, field: 'issue'})
	@Mutation(() => OrchardEcashOperation, {description: "Issue ecash on the Orchard mint into the current user's wallet"})
	async ecash_issue(
		@Context() context: any,
		@Args('unit', {description: 'Unit to issue'}) unit: string,
		@Args('amount', {type: () => Float, description: 'Amount in the smallest unit'}) amount: number,
		@Args('memo', {type: () => String, nullable: true, description: 'Note shown in wallet history'}) memo: string | null,
	): Promise<OrchardEcashOperation> {
		const tag = 'MUTATION { ecash_issue }';
		this.logger.debug(tag);
		return await this.ecashOperationService.issueEcash(tag, context.req.user.id, normalizeMintUnit(unit), amount, memo ?? null);
	}
}

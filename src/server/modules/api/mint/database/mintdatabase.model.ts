/* Core Dependencies */
import {Field, Float, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {Base64} from '#server/modules/graphql/scalars/base64.scalar';
/* Native Dependencies */
import type {CashuMintDatabaseInfo} from '#server/modules/cashu/mintdb/cashumintdb.types';

@ObjectType({description: 'Cashu mint database backup'})
export class OrchardMintDatabaseBackup {
	@Field(() => Base64, {description: 'Base64-encoded database backup file'})
	filebase64: string;

	constructor(filebase64: string) {
		this.filebase64 = filebase64;
	}
}

@ObjectType({description: 'Cashu mint database restore result'})
export class OrchardMintDatabaseRestore {
	@Field({description: 'Whether the restore completed successfully'})
	success: boolean;

	constructor(success: boolean) {
		this.success = success;
	}
}

@ObjectType({description: 'Cashu mint database information'})
export class OrchardMintDatabaseInfo {
	@Field(() => Float, {description: 'Database file size in bytes'})
	size: number;

	@Field({description: 'Database engine type'})
	type: string;

	constructor(info: CashuMintDatabaseInfo) {
		this.size = info.size;
		this.type = info.type;
	}
}

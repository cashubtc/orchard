/* Core Dependencies */
import {Field, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {LightningRequest} from '#server/modules/lightning/lightning/lightning.types';
import {LightningRequestType} from '#server/modules/lightning/lightning.enums';

@ObjectType({description: 'Decoded lightning payment request'})
export class OrchardLightningRequest {
	@Field(() => LightningRequestType, {description: 'Type of lightning request (e.g. invoice, offer)'})
	type: LightningRequestType;

	@Field(() => Boolean, {description: 'Whether the request is valid'})
	valid: boolean;

	@Field(() => Number, {nullable: true, description: 'Request expiry time in seconds'})
	expiry: number;

	@Field(() => String, {nullable: true, description: 'Human-readable description of the request'})
	description: string;

	@Field(() => Number, {nullable: true, description: 'Maximum quantity allowed for the offer'})
	offer_quantity_max: number;

	constructor(lnrequest: LightningRequest) {
		this.type = lnrequest.type;
		this.valid = lnrequest.valid;
		this.expiry = lnrequest.expiry;
		this.description = lnrequest.description;
		this.offer_quantity_max = lnrequest.offer_quantity_max;
	}
}

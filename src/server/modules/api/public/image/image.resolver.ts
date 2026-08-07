/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Args} from '@nestjs/graphql';
/* Local Dependencies */
import {PublicImageService} from './image.service.js';
import {OrchardPublicImage} from './image.model.js';

@Resolver(() => OrchardPublicImage)
export class PublicImageResolver {
	private readonly logger = new Logger(PublicImageResolver.name);

	constructor(private publicImageService: PublicImageService) {}

	@Query(() => OrchardPublicImage, {description: 'Get image data from a URL'})
	async public_image(@Args('url', {description: 'URL of the image to fetch'}) url: string): Promise<OrchardPublicImage> {
		const tag = 'GET { image }';
		this.logger.debug(tag);
		return await this.publicImageService.getImageData(tag, url);
	}
}

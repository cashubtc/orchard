/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Vendor Dependencies */
import {TypeOrmModule} from '@nestjs/typeorm';
/* Application Dependencies */
import {MessageModule} from '@server/modules/message/message.module';
import {AgentModule} from '@server/modules/ai/agent/agent.module';
/* Local Dependencies */
import {Conversation} from './conversation.entity.js';
import {ConversationService} from './conversation.service.js';

@Module({
	imports: [TypeOrmModule.forFeature([Conversation]), MessageModule, AgentModule],
	providers: [ConversationService],
	exports: [ConversationService],
})
export class ConversationModule {}

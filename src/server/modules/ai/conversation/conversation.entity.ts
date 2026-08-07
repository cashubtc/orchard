/* Vendor Dependencies */
import {Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index, type Relation} from 'typeorm';
/* Application Dependencies */
import {Agent} from '#server/modules/ai/agent/agent.entity';
/* Local Dependencies */
import {ConversationStatus} from './conversation.enums.js';

@Entity('conversations')
@Index('IDX_conversations_chat_status', ['chat_id', 'status'])
@Index('IDX_conversations_status_activity', ['status', 'last_activity_at'])
export class Conversation {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@ManyToOne(() => Agent, {onDelete: 'CASCADE'})
	@JoinColumn({name: 'source_agent_id'})
	source_agent: Relation<Agent>;

	@Column({type: 'text'})
	user_id: string;

	@Column({type: 'text'})
	chat_id: string;

	@Column({type: 'text', default: ConversationStatus.ACTIVE})
	status: ConversationStatus;

	@Column({type: 'text', default: '[]'})
	messages: string;

	@Column({type: 'integer', default: 0})
	tokens_used: number;

	@Column({type: 'integer'})
	created_at: number;

	@Column({type: 'integer'})
	last_activity_at: number;
}

/* Vendor Dependencies */
import {Entity, Column, PrimaryGeneratedColumn, OneToMany} from 'typeorm';
/* Local Dependencies */
import {AgentKey, AgentScheduleKind} from './agent.enums.js';
import {AgentRun} from './agent-run.entity.js';

@Entity('agents')
export class Agent {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({type: 'text', nullable: true, unique: true})
	agent_key: AgentKey | null;

	@Column({type: 'text', nullable: true})
	name: string | null;

	@Column({type: 'text', nullable: true})
	description: string | null;

	@Column({type: 'boolean', default: false})
	active: boolean;

	@Column({type: 'text', nullable: true})
	model: string | null;

	@Column({type: 'text', nullable: true})
	system_message: string | null;

	@Column({type: 'text', nullable: true})
	tools: string | null;

	@Column({type: 'text', default: '[]'})
	schedules: string;

	@Column({type: 'text', default: AgentScheduleKind.CRON})
	schedule_kind: AgentScheduleKind;

	@Column({type: 'text', nullable: true})
	schedule_tz: string | null;

	@Column({type: 'integer', nullable: true})
	last_run_at: number | null;

	@Column({type: 'text', nullable: true})
	last_run_status: string | null;

	@Column({type: 'integer'})
	created_at: number;

	@Column({type: 'integer'})
	updated_at: number;

	@OneToMany(() => AgentRun, (run) => run.agent, {cascade: true})
	runs: AgentRun[];
}

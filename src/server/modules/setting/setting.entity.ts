/* Vendor Dependencies */
import {Entity, Column, PrimaryColumn} from 'typeorm';

/* Local Dependencies */
import {SettingValue} from './setting.enums.js';
import type {StoredSettingKey} from './setting.types.js';

@Entity('settings')
export class Setting<K extends StoredSettingKey = StoredSettingKey> {
	@PrimaryColumn({type: 'varchar', length: 100})
	key: K; // unique setting key

	@Column({type: 'text'})
	value: string; // JSON-serialized value for flexibility

	@Column({type: 'text', nullable: true, length: 255})
	description: string | null; // human-readable description of what this setting does

	@Column({type: 'text', default: SettingValue.STRING, length: 50})
	value_type: SettingValue;
}

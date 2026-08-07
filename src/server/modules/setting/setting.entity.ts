/* Vendor Dependencies */
import {Entity, Column, PrimaryColumn} from 'typeorm';
/* Local Dependencies */
import {SettingKey, SettingValue} from './setting.enums.js';

@Entity('settings')
export class Setting {
	@PrimaryColumn({type: 'varchar', length: 100})
	key: SettingKey; // unique setting key

	@Column({type: 'text'})
	value: string; // JSON-serialized value for flexibility

	@Column({type: 'text', nullable: true, length: 255})
	description: string | null; // human-readable description of what this setting does

	@Column({type: 'text', default: SettingValue.STRING, length: 50})
	value_type: SettingValue;
}

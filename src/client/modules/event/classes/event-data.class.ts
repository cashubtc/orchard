/* Vendor Dependencies */
import {v4 as uuidv4} from 'uuid';

interface EventDataSeed {
	type: 'PENDING' | 'SAVING' | 'SUBSCRIBED' | 'SUCCESS' | 'WARNING' | 'ERROR';
	message?: string;
	duration?: number | null;
	progress?: number | null;
}

const DURATION = {
	PENDING: null,
	SAVING: null,
	SUBSCRIBED: null,
	SUCCESS: 3000,
	WARNING: 5000,
	ERROR: 5000,
};

export class EventData {
	type: 'PENDING' | 'SAVING' | 'SUBSCRIBED' | 'SUCCESS' | 'WARNING' | 'ERROR';
	id: string;
	message?: string;
	created_at: number;
	duration: number | null;
	progress: number | null;
	confirmed: boolean | null;

	constructor(data: EventDataSeed) {
		this.type = data.type;
		this.id = uuidv4();
		this.message = data.message;
		this.created_at = Math.floor(Date.now() / 1000);
		this.duration = data.duration || DURATION[this.type];
		this.progress = data.progress || null;
		this.confirmed = null;
	}
}

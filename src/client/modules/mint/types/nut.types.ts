/* Shared Dependencies */
import type {OrchardNuts} from '@shared/generated.types';

export type MintNut = Exclude<keyof OrchardNuts, '__typename'>;

export type Nut15Method = {
	unit: string;
	methods: string[];
};

export type Nut17Commands = {
	unit: string;
	methods: {
		method: string;
		commands: string[];
	}[];
};

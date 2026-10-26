/* Core Dependencies */
import type {FormControl, FormRecord} from '@angular/forms';
/* Shared Dependencies */
import type {ServiceKind} from '@shared/generated.types';

export type ServiceForm = FormRecord<FormControl<string>>;
export type ServiceField = {
	key: string;
	label: string;
	placeholder?: string;
	credential?: boolean;
	password?: boolean;
	multiline?: boolean;
	optional?: boolean;
	heading?: string;
};
export type ServiceDescriptor = {name: string; icon: string; description: string; types: {value: string; label: string}[]};
export type ServiceDescriptors = Record<ServiceKind, ServiceDescriptor>;

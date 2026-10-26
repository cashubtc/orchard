/* Core Dependencies */
import type {FormControl, FormRecord} from '@angular/forms';
/* Shared Dependencies */
import type {OrchardConnectionCheck, OrchardServiceConfiguration, ServiceKind} from '@shared/generated.types';

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

export type ServiceFieldState = ServiceField & {
	stored: boolean;
	cleared: boolean;
	placeholder: string;
	hot: boolean;
	flagged: boolean;
	credential_caption: boolean;
	span: number;
};

export type ServiceApplied = {
	check: OrchardConnectionCheck;
	configuration: OrchardServiceConfiguration;
};

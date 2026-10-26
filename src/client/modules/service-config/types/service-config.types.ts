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
	pem?: boolean;
	help?: string;
	advanced?: boolean;
};
export type ServiceOption = {value: string; label: string; detail: string};
export type ServiceDescriptor = {name: string; icon: string; description: string; types: ServiceOption[]};
export type ServiceDescriptors = Record<ServiceKind, ServiceDescriptor>;

export type ServicePemMask = {begin: string; end: string; hidden: number};
export type ServiceFieldState = ServiceField & {
	stored: boolean;
	cleared: boolean;
	placeholder: string;
	hot: boolean;
	flagged: boolean;
	credential_caption: boolean;
	span: number;
	section: string | null;
	help_open: boolean;
	saved_view: boolean;
	replacing: boolean;
	mask: ServicePemMask | null;
	description: string;
	rows: number;
};

export type ServiceApplied = {
	check: OrchardConnectionCheck;
	configuration: OrchardServiceConfiguration;
};

/* Core Dependencies */
import {
	ChangeDetectionStrategy,
	Component,
	Input,
	input,
	ViewChild,
	ElementRef,
	Output,
	EventEmitter,
	AfterViewInit,
	ChangeDetectorRef,
} from '@angular/core';
import {FormGroup, FormArray} from '@angular/forms';
/* Vendor Dependencies */
import {MatSelect} from '@angular/material/select';
/* Native Dependencies */
import {MintContactMethod} from '@client/modules/mint/types/mint-contact.types';
import {MINT_CONTACT_METHODS} from '@client/modules/mint/constants/mint.constants';

@Component({
	selector: 'orc-mint-subsection-info-form-contact',
	standalone: false,
	templateUrl: './mint-subsection-info-form-contact.component.html',
	styleUrl: './mint-subsection-info-form-contact.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionInfoFormContactComponent implements AfterViewInit {
	@Input() form_group!: FormGroup;
	@Input() form_array!: FormArray;
	@Input() array_name!: string;
	@Input() subgroup_index!: number;
	@Input() focused!: boolean;
	@Input() init_method!: string | null;
	public device_mobile = input.required<boolean>(); // whether the device is mobile

	@Output() update = new EventEmitter<number>();
	@Output() cancel = new EventEmitter<number>();
	@Output() remove = new EventEmitter<number>();

	@ViewChild('element_method') element_method!: MatSelect;
	@ViewChild('element_info') element_info!: ElementRef<HTMLInputElement>;

	public options: MintContactMethod[] = MINT_CONTACT_METHODS;

	public get method_option(): MintContactMethod | undefined {
		const method = this.form_array.at(this.subgroup_index).get('method')?.value;
		const selected_option = this.options.find((option) => option.method === method);
		return selected_option;
	}

	public get method_form_hot(): boolean {
		if (this.element_method?.focused) return true;
		return this.form_array.at(this.subgroup_index).get('method')?.dirty ? true : false;
	}

	public get info_form_hot(): boolean {
		if (document.activeElement === this.element_info?.nativeElement) return true;
		return this.form_array.at(this.subgroup_index).get('info')?.dirty ? true : false;
	}

	public get group_invalid(): boolean {
		return (
			(this.form_array.at(this.subgroup_index).invalid &&
				(this.form_array.at(this.subgroup_index).dirty || this.form_array.at(this.subgroup_index).touched)) ||
			false
		);
	}

	constructor(private cdr: ChangeDetectorRef) {}

	ngAfterViewInit(): void {
		if (this.focused) {
			setTimeout(() => {
				this.element_info.nativeElement.focus();
			});
		}
		if (this.init_method) this.form_array.at(this.subgroup_index).get('method')?.setValue(this.init_method);
	}

	public onSubmit(event: Event): void {
		event.preventDefault();
		this.update.emit(this.subgroup_index);
		this.element_info.nativeElement.blur();
		this.element_method.close();
	}

	public onCancel(event: Event): void {
		event.preventDefault();
		this.cdr.detectChanges();
		this.cancel.emit(this.subgroup_index);
		this.element_info.nativeElement.blur();
		this.element_method.close();
	}

	public onRemove(event: Event): void {
		event.preventDefault();
		event.stopPropagation();
		this.remove.emit(this.subgroup_index);
		this.element_info.nativeElement.blur();
		this.element_method.close();
	}
}

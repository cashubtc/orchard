import {ComponentFixture, TestBed} from '@angular/core/testing';
import {SettingsSubsectionAppAiJobExecuteComponent} from './settings-subsection-app-ai-job-execute.component';
import {FormPanelRef} from '@client/modules/form/services/form-panel/form-panel-ref';
import {FORM_PANEL_DATA} from '@client/modules/form/services/form-panel/form-panel.types';
import {AiService} from '@client/modules/ai/services/ai/ai.service';
import {NEVER} from 'rxjs';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {MatBottomSheetRef} from '@angular/material/bottom-sheet';

describe('SettingsSubsectionAppAiJobExecuteComponent', () => {
	let component: SettingsSubsectionAppAiJobExecuteComponent;
	let fixture: ComponentFixture<SettingsSubsectionAppAiJobExecuteComponent>;

	const create = async (sheet: boolean) => {
		await TestBed.configureTestingModule({
			declarations: [SettingsSubsectionAppAiJobExecuteComponent],
			providers: [
				{provide: FORM_PANEL_DATA, useValue: {id: 'test-id', name: 'Test Agent'}},
				{provide: FormPanelRef, useValue: {close: jasmine.createSpy('close')}},
				{provide: AiService, useValue: {executeAiAgent: jasmine.createSpy('executeAiAgent').and.returnValue(NEVER)}},
				...(sheet ? [{provide: MatBottomSheetRef, useValue: {}}] : []),
			],
			schemas: [NO_ERRORS_SCHEMA],
		}).compileComponents();

		fixture = TestBed.createComponent(SettingsSubsectionAppAiJobExecuteComponent);
		component = fixture.componentInstance;
	};

	it('should create', async () => {
		await create(false);
		expect(component).toBeTruthy();
	});

	it('should format time correctly', async () => {
		await create(false);
		expect(component.formatTime(0)).toBe('00:00');
		expect(component.formatTime(65)).toBe('01:05');
		expect(component.formatTime(3600)).toBe('60:00');
	});

	it('lays out as a side panel', async () => {
		await create(false);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.orc-form-panel')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('.orc-form-panel-sheet')).toBeNull();
	});

	it('lays out as a bottom sheet when opened in one', async () => {
		await create(true);
		fixture.detectChanges();
		expect(component.sheet).toBeTrue();
		expect(fixture.nativeElement.querySelector('.orc-form-panel-sheet')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('.orc-form-panel')).toBeNull();
	});
});

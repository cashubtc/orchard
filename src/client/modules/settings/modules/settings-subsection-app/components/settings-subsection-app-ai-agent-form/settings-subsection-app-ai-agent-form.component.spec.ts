/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {MatBottomSheetRef} from '@angular/material/bottom-sheet';
/* Application Dependencies */
import {FormPanelRef} from '@client/modules/form/services/form-panel/form-panel-ref';
import {FORM_PANEL_DATA} from '@client/modules/form/services/form-panel/form-panel.types';
/* Native Dependencies */
import {OrcSettingsSubsectionAppModule} from '@client/modules/settings/modules/settings-subsection-app/settings-subsection-app.module';
import {SettingsSubsectionAppAiAgentFormComponent} from './settings-subsection-app-ai-agent-form.component';

describe('SettingsSubsectionAppAiAgentFormComponent', () => {
	let component: SettingsSubsectionAppAiAgentFormComponent;
	let fixture: ComponentFixture<SettingsSubsectionAppAiAgentFormComponent>;

	const create = async (sheet: boolean) => {
		await TestBed.configureTestingModule({
			imports: [OrcSettingsSubsectionAppModule],
			providers: [
				{provide: FormPanelRef, useValue: {close: jasmine.createSpy('close')}},
				{
					provide: FORM_PANEL_DATA,
					useValue: {
						mode: 'create',
						agent: null,
						models: [],
						tools: [],
						device_type: 'desktop',
						vendor: '',
						favorites: {ollama: [], openrouter: []},
						fullscreen_system_message: true,
						app_settings: null,
						config: null,
					},
				},
				...(sheet ? [{provide: MatBottomSheetRef, useValue: {}}] : []),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(SettingsSubsectionAppAiAgentFormComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	};

	it('should create', async () => {
		await create(false);
		expect(component).toBeTruthy();
	});

	it('lays out as a side panel, opening the system prompt fullscreen when asked', async () => {
		await create(false);
		expect(fixture.nativeElement.querySelector('.orc-form-panel')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('.orc-form-panel-sheet-actions')).toBeNull();
		expect(component.fullscreen_system_message()).toBeTrue();
	});

	it('lays out as a bottom sheet with Save pinned below, keeping the system prompt inline', async () => {
		await create(true);
		expect(component.sheet).toBeTrue();
		expect(fixture.nativeElement.querySelector('.orc-form-panel')).toBeNull();
		expect(fixture.nativeElement.querySelector('.orc-form-panel-sheet-actions')?.textContent).toContain('Save');
		expect(component.fullscreen_system_message()).toBeFalse();
		expect(fixture.nativeElement.querySelector('.fullscreen-button')).toBeNull();
	});
});

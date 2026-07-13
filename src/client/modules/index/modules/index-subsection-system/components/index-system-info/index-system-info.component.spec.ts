/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {SystemInfo} from '@client/modules/index/classes/system-info.class';
/* Local Dependencies */
import {IndexSystemInfoComponent} from './index-system-info.component';

const mock_info = new SystemInfo({
	os_platform: 'linux',
	os_release: '6.8.0',
	arch: 'arm64',
	cpu_model: 'Apple M2',
	cpu_cores: 8,
	memory_total_bytes: 17179869184,
	disk_total_bytes: 512000000000,
	node_version: 'v22.3.0',
	v8_version: '12.4.254.21-node.19',
	heap_limit_mb: 4144,
});

describe('IndexSystemInfoComponent', () => {
	let component: IndexSystemInfoComponent;
	let fixture: ComponentFixture<IndexSystemInfoComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [IndexSystemInfoComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(IndexSystemInfoComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('info', null);
		fixture.componentRef.setInput('loading', true);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('renders shimmer placeholders while loading', () => {
		const overlays = fixture.nativeElement.querySelectorAll('.loading-stat-overlay');
		expect(overlays.length).toBe(5);
	});

	it('renders five tiles when info is loaded', () => {
		fixture.componentRef.setInput('info', mock_info);
		fixture.componentRef.setInput('loading', false);
		fixture.detectChanges();
		const tiles = fixture.nativeElement.querySelectorAll('.index-system-info-tile');
		expect(tiles.length).toBe(5);
		expect(fixture.nativeElement.textContent).toContain('linux 6.8.0');
		expect(fixture.nativeElement.textContent).toContain('8 cores');
		expect(fixture.nativeElement.textContent).toContain('16 GB');
	});

	it('renders nothing when info failed to load', () => {
		fixture.componentRef.setInput('info', null);
		fixture.componentRef.setInput('loading', false);
		fixture.detectChanges();
		const tiles = fixture.nativeElement.querySelectorAll('.index-system-info-tile');
		expect(tiles.length).toBe(0);
	});
});

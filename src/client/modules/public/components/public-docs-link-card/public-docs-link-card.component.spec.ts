/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {MatDialog} from '@angular/material/dialog';
/* Native Dependencies */
import {OrcPublicModule} from '@client/modules/public/public.module';
import {PublicExitWarningComponent} from '@client/modules/public/components/public-exit-warning/public-exit-warning.component';
/* Local Dependencies */
import {PublicDocsLinkCardComponent} from './public-docs-link-card.component';

describe('PublicDocsLinkCardComponent', () => {
	let component: PublicDocsLinkCardComponent;
	let fixture: ComponentFixture<PublicDocsLinkCardComponent>;
	let dialog: jasmine.SpyObj<MatDialog>;

	beforeEach(async () => {
		dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);

		await TestBed.configureTestingModule({
			imports: [OrcPublicModule],
			providers: [{provide: MatDialog, useValue: dialog}],
		}).compileComponents();

		fixture = TestBed.createComponent(PublicDocsLinkCardComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('docs_link', 'https://docs.orchard.space/install/configuration/#bitcoin');
		fixture.componentRef.setInput('link_title', 'Bitcoin configuration docs');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should open the safe-exit warning with the docs link', () => {
		component.onDocsLink();

		expect(dialog.open).toHaveBeenCalledWith(PublicExitWarningComponent, {
			data: {link: 'https://docs.orchard.space/install/configuration/#bitcoin'},
		});
	});

	it('should render the short link title', () => {
		const compiled = fixture.nativeElement as HTMLElement;

		expect(compiled.textContent).toContain('Bitcoin configuration docs');
		expect(compiled.textContent).not.toContain('https://docs.orchard.space/install/configuration/#bitcoin');
	});
});

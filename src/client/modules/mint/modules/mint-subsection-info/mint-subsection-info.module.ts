/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule} from '@angular/forms';
import {RouterModule} from '@angular/router';
/* Vendor Dependencies */
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatCardModule} from '@angular/material/card';
import {MatRippleModule} from '@angular/material/core';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatIconModule} from '@angular/material/icon';
import {MatSelectModule} from '@angular/material/select';
import {MatButtonModule} from '@angular/material/button';
/* Application Dependencies */
import {OrcFormModule} from '@client/modules/form/form.module';
import {pendingEventGuard} from '@client/modules/event/guards/pending-event.guard';
import {FederationSettingsSummaryComponent} from '@client/modules/federation/components/federation-settings-summary/federation-settings-summary.component';
import {FederationSettingsHintComponent} from '@client/modules/federation/components/federation-settings-hint/federation-settings-hint.component';
/* Local Dependencies */
import {MintSubsectionInfoComponent} from './components/mint-subsection-info/mint-subsection-info.component';
import {MintSubsectionInfoFormNameComponent} from './components/mint-subsection-info-form-name/mint-subsection-info-form-name.component';
import {MintSubsectionInfoFormIconComponent} from './components/mint-subsection-info-form-icon/mint-subsection-info-form-icon.component';
import {MintSubsectionInfoFormDescriptionComponent} from './components/mint-subsection-info-form-description/mint-subsection-info-form-description.component';
import {MintSubsectionInfoFormDescriptionLongComponent} from './components/mint-subsection-info-form-description-long/mint-subsection-info-form-description-long.component';
import {MintSubsectionInfoFormContactsComponent} from './components/mint-subsection-info-form-contacts/mint-subsection-info-form-contacts.component';
import {MintSubsectionInfoFormContactComponent} from './components/mint-subsection-info-form-contact/mint-subsection-info-form-contact.component';
import {MintSubsectionInfoFormUrlsComponent} from './components/mint-subsection-info-form-urls/mint-subsection-info-form-urls.component';
import {MintSubsectionInfoFormUrlComponent} from './components/mint-subsection-info-form-url/mint-subsection-info-form-url.component';
import {MintSubsectionInfoFormMotdComponent} from './components/mint-subsection-info-form-motd/mint-subsection-info-form-motd.component';

@NgModule({
	declarations: [
		MintSubsectionInfoComponent,
		MintSubsectionInfoFormNameComponent,
		MintSubsectionInfoFormIconComponent,
		MintSubsectionInfoFormDescriptionComponent,
		MintSubsectionInfoFormDescriptionLongComponent,
		MintSubsectionInfoFormContactsComponent,
		MintSubsectionInfoFormContactComponent,
		MintSubsectionInfoFormUrlsComponent,
		MintSubsectionInfoFormUrlComponent,
		MintSubsectionInfoFormMotdComponent,
	],
	imports: [
		FederationSettingsSummaryComponent,
		FederationSettingsHintComponent,
		RouterModule.forChild([
			{
				path: '',
				component: MintSubsectionInfoComponent,
				canDeactivate: [pendingEventGuard],
			},
		]),
		CommonModule,
		ReactiveFormsModule,
		MatFormFieldModule,
		MatInputModule,
		MatCardModule,
		MatRippleModule,
		MatProgressSpinnerModule,
		MatIconModule,
		MatSelectModule,
		MatButtonModule,
		OrcFormModule,
	],
	exports: [],
})
export class OrcMintSubsectionInfoModule {}

/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule} from '@angular/forms';
/* Vendors Dependencies */
import {OverlayModule} from '@angular/cdk/overlay';
import {PortalModule} from '@angular/cdk/portal';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatMenuModule} from '@angular/material/menu';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatTableModule} from '@angular/material/table';
import {MatCardModule} from '@angular/material/card';
import {MatBadgeModule} from '@angular/material/badge';
import {MatListModule} from '@angular/material/list';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
/* Application Dependencies */
import {OrcFormModule} from '@client/modules/form/form.module';
import {OrcCrewModule} from '@client/modules/crew/crew.module';
/* Local Dependencies */
import {AiInputComponent} from './components/ai-input/ai-input.component';
import {AiNavComponent} from './components/ai-nav/ai-nav.component';
import {AiCommandComponent} from './components/ai-command/ai-command.component';
import {AiModelComponent} from './components/ai-model/ai-model.component';
import {AiConversationHudComponent} from './components/ai-conversation-hud/ai-conversation-hud.component';
import {AiChatLogComponent} from './components/ai-chat-log/ai-chat-log.component';
import {AiAssistantComponent} from './components/ai-assistant/ai-assistant.component';
import {AiChatAvatarComponent} from './components/ai-chat-avatar/ai-chat-avatar.component';
import {AiChatMessageSystemComponent} from './components/ai-chat-message-system/ai-chat-message-system.component';
import {AiChatMessageUserComponent} from './components/ai-chat-message-user/ai-chat-message-user.component';
import {AiChatMessageAssistantComponent} from './components/ai-chat-message-assistant/ai-chat-message-assistant.component';
import {AiChatMessagePendingComponent} from './components/ai-chat-message-pending/ai-chat-message-pending.component';
import {AiChatMessageToolcallComponent} from './components/ai-chat-message-toolcall/ai-chat-message-toolcall.component';
import {AiThoughtPipe} from './pipes/ai-thought/ai-thought.pipe';
import {AiAssistantDefinitionComponent} from './components/ai-assistant-definition/ai-assistant-definition.component';
import {AiAssistantDefinitionToolComponent} from './components/ai-assistant-definition-tool/ai-assistant-definition-tool.component';
import {AiChatMessageErrorComponent} from './components/ai-chat-message-error/ai-chat-message-error.component';
import {AiVendorIconComponent} from './components/ai-vendor-icon/ai-vendor-icon.component';

@NgModule({
	declarations: [
		AiInputComponent,
		AiNavComponent,
		AiCommandComponent,
		AiModelComponent,
		AiConversationHudComponent,
		AiChatLogComponent,
		AiAssistantComponent,
		AiChatAvatarComponent,
		AiChatMessageSystemComponent,
		AiChatMessageUserComponent,
		AiChatMessageAssistantComponent,
		AiChatMessagePendingComponent,
		AiChatMessageToolcallComponent,
		AiThoughtPipe,
		AiAssistantDefinitionComponent,
		AiAssistantDefinitionToolComponent,
		AiChatMessageErrorComponent,
		AiVendorIconComponent,
	],
	imports: [
		CommonModule,
		ReactiveFormsModule,
		OverlayModule,
		PortalModule,
		MatFormFieldModule,
		MatInputModule,
		MatIconModule,
		MatButtonModule,
		MatMenuModule,
		MatExpansionModule,
		MatTableModule,
		MatCardModule,
		MatBadgeModule,
		MatListModule,
		MatAutocompleteModule,
		OrcFormModule,
		OrcCrewModule,
	],
	exports: [AiNavComponent, AiChatLogComponent, AiVendorIconComponent, AiModelComponent],
})
export class OrcAiModule {}

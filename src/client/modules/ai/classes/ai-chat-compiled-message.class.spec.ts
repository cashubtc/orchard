/* Native Dependencies */
import {AiChatMessage} from '@client/modules/ai/classes/ai-chat-chunk.class';
/* Local Dependencies */
import {AiChatCompiledMessage} from './ai-chat-compiled-message.class';
/* Shared Dependencies */
import {AiMessageRole} from '@shared/generated.types';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const message = (): AiChatMessage =>
	new AiChatMessage({
		content: 'hi',
		role: AiMessageRole.Assistant,
		thinking: null,
		tool_calls: null,
	} as any);

describe('AiChatCompiledMessage', () => {
	it('assigns a v4 uuid as id (works in non-secure-context browsers, unlike crypto.randomUUID)', () => {
		const compiled = new AiChatCompiledMessage('conv-1', message());
		expect(compiled.id).toMatch(UUID_V4_REGEX);
	});

	it('produces a unique id per instance', () => {
		const ids = new Set(Array.from({length: 100}, () => new AiChatCompiledMessage('conv-1', message()).id));
		expect(ids.size).toBe(100);
	});
});

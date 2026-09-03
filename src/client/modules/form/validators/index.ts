import {micros} from './micros';
import {minGreaterThan} from './min-greater-than';
import {integer} from './integer';
import {decimals} from './decimals';
import {url} from './url';
import {openrouterKey} from './openrouter-key';
import {telegramBotToken} from './telegram-bot-token';

export class OrchardValidators {
	static micros = micros;
	static minGreaterThan = minGreaterThan;
	static integer = integer;
	static decimals = decimals;
	static url = url;
	static openrouterKey = openrouterKey;
	static telegramBotToken = telegramBotToken;
}

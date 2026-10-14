/* Vendor Dependencies */
import {Subject, Observable} from 'rxjs';

/**
 * Reference to a form panel opened via FormPanelService.
 * Mirrors the MatDialogRef API — consumers call close() with an optional result,
 * and callers subscribe to afterClosed() to react.
 */
export class FormPanelRef<R = any> {
	private readonly _after_closed = new Subject<R | undefined>();
	private result: R | undefined;

	/** Emits when the panel is closed, with an optional result value */
	public afterClosed(): Observable<R | undefined> {
		return this._after_closed.asObservable();
	}

	/** Sets the result handed back however the panel ends up closed, for work that is done before the panel closes itself */
	public setResult(result: R): void {
		this.result = result;
	}

	/** Close the panel, optionally passing a result back to the opener; without one, any result set earlier */
	public close(result: R | undefined = this.result): void {
		this._after_closed.next(result);
		this._after_closed.complete();
	}
}

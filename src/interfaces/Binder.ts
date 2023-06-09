import type { BindingContext } from './BindingContext.js';

/** @public */
// eslint-disable-next-line @typescript-eslint/no-type-alias
export type FixedScopeBindingOptions = 'toConstantValue';

/**
 * @public
 */
export interface Binder<in out T> {
	to: (fn: new () => T) => void;
	toConstantValue: ((v: T) => void) & ((v: Promise<T>) => Promise<void>);
	toDynamicValue: (fn: (context: BindingContext<T>) => T | Promise<T>) => void;
}

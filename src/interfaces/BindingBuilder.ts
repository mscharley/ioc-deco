import type { Binder } from './Binder';
import type { BindingScope } from './BindingScope';

/**
 * @public
 */
export interface BindingBuilder<in T> extends Binder<T>, BindingScope<T, BindingBuilder<T>> {}

import type * as interfaces from '../interfaces/index.js';
import { addInjection } from './injectable.js';
import { Container } from '../Container.js';
import type { Token } from '../Token.js';

/** @public */
export interface InjectDecoratorFactory {
	<T>(token: Token<T>, options: Partial<interfaces.InjectOptions> & { multiple: true }): InjectDecorator<T[]>;
	<T>(token: Token<T>, options: Partial<interfaces.InjectOptions> & { optional: true }): InjectDecorator<T | undefined>;
	<T>(token: Token<T>, options?: Partial<interfaces.InjectOptions>): InjectDecorator<T>;
}

/* eslint-disable @typescript-eslint/ban-types */
/** @public */
export interface InjectDecorator<T> {
	(target: undefined, context: ClassFieldDecoratorContext<unknown, T>): (originalValue: T | undefined) => T;
	(target: { constructor: Function }, propertyName: string | symbol): undefined;
}
/* eslint-enable @typescript-eslint/ban-types */

/**
 * @public
 */
export const inject: InjectDecoratorFactory = <T>(
	token: Token<T>,
	options?: Partial<interfaces.InjectOptions>,
): InjectDecorator<T> => {
	const opts: interfaces.InjectOptions = {
		multiple: false,
		optional: false,
		...options,
	};

	return ((target, context) => {
		/* c8 ignore start */
		if (target != null) {
			// experimental
			addInjection({
				type: 'property',
				name: context as Exclude<typeof context, ClassFieldDecoratorContext<unknown, T>>,
				token,
				options: opts,
			});

			return undefined;
			/* c8 ignore end */
		} else {
			// tc39
			addInjection({
				type: 'property',
				name: (context as ClassFieldDecoratorContext<unknown, T>).name,
				token,
				options: opts,
			});

			return (_originalValue: T | undefined): T => {
				const value = Container.resolve<T>(token);

				return value;
			};
		}
	}) as InjectDecorator<T>;
};

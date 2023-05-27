import { Container } from './Container';
import type { Token } from './Token';

/**
 * @public
 */
export const injectable =
	() =>
	<T>(_target: new () => T, _context?: ClassDecoratorContext<new () => T>): void => {
		/* no op */
	};

/**
 * @public
 */
export const inject =
	<T>(token: Token<T>) =>
	(_target: undefined, _context?: ClassFieldDecoratorContext) =>
	(_originalValue: T | undefined): T => {
		const value = Container.resolve<T>(token);

		return value;
	};

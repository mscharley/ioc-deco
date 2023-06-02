import type * as interfaces from './interfaces';
import type { Container } from './Container';
import type { Token } from './Token';

const isPromise = <T>(v: T | Promise<T>): v is Promise<T> => v != null && typeof (v as Promise<T>).then === 'function';

export class BindingBuilder<T> implements interfaces.BindingBuilder<T> {
	readonly #container: Container;
	readonly #token: Token<T>;
	#scope: interfaces.ScopeOptions;
	static readonly #incompleteBindings = new Set<BindingBuilder<unknown>>();

	public constructor(container: Container, token: Token<T>) {
		this.#container = container;
		this.#token = token;
		this.#scope = container.config.defaultScope;
		BindingBuilder.#incompleteBindings.add(this);
	}

	public static validateBindings(container: Container): void {
		const invalidBindings = [...BindingBuilder.#incompleteBindings.values()].filter((v) => v.#container === container);

		if (invalidBindings.length > 0) {
			throw new Error(
				`Some bindings were started but not completed: ${invalidBindings
					.map((v) => v.#token.identifier.toString())
					.join(', ')}`,
			);
		}
	}

	public to(fn: new () => T): void {
		BindingBuilder.#incompleteBindings.delete(this);
		this.#container.addBinding(this.#token, this.#scope, () => new fn());
	}

	public toConstantValue(v: T): void;
	public toConstantValue(v: Promise<T>): Promise<void>;
	public toConstantValue(v: T | Promise<T>): void | Promise<void> {
		BindingBuilder.#incompleteBindings.delete(this);
		if (isPromise(v)) {
			return v.then((value) => this.#container.addBinding(this.#token, this.#scope, () => value));
		} else {
			return this.#container.addBinding(this.#token, this.#scope, () => v);
		}
	}

	public toDynamicValue(fn: (context: interfaces.BindingContext) => T): void {
		BindingBuilder.#incompleteBindings.delete(this);
		this.#container.addBinding(this.#token, this.#scope, () => fn({ container: this.#container }));
	}

	public inSingletonScope(): this {
		this.#scope = 'singleton';
		return this;
	}

	public inTransientScope(): this {
		this.#scope = 'transient';
		return this;
	}

	public inRequestScope(): this {
		this.#scope = 'request';
		return this;
	}
}

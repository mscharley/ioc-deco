import type * as interfaces from './interfaces/index.js';
import type { Binding } from './models/Binding.js';
import { BindingBuilder } from './BindingBuilder.js';
import { calculatePlan } from './planner/calculatePlan.js';
import { executePlan } from './planner/executePlan.js';
import { isNever } from './util/isNever.js';
import type { Request } from './models/Request.js';
import type { Token } from './Token.js';

export class Container implements interfaces.Container {
	static #currentRequest: Request<unknown> | undefined;

	public static get isProcessingRequest(): boolean {
		return this.#currentRequest != null;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	readonly #incompleteBindings = new Set<BindingBuilder<any>>();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	#bindings: Array<Binding<any>> = [];
	readonly #singletonCache: Record<symbol, unknown> = {};
	public readonly config: Readonly<interfaces.ContainerConfiguration>;

	public constructor(config?: Partial<interfaces.ContainerConfiguration>) {
		this.config = {
			defaultScope: 'transient',
			...config,
		};
	}

	public static resolve<T>(token: Token<T>): T {
		if (this.#currentRequest == null) {
			throw new Error(
				`Unable to resolve token as no container is currently making a request: ${token.identifier.toString()}`,
			);
		}

		if (!(token.identifier in this.#currentRequest.stack)) {
			throw new Error(`Token hasn't been created yet: ${token.identifier.toString()}`);
		}
		const tokenStack = this.#currentRequest.stack[token.identifier] as T[];
		const [value] = tokenStack.splice(0, 1);
		if (tokenStack.length === 0) {
			delete this.#currentRequest.stack[token.identifier];
		}

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		return value!;
	}

	#validateBindings = (): void => {
		const values = [...this.#incompleteBindings.values()];
		if (values.length > 0) {
			throw new Error(
				`Some bindings were started but not completed: ${values.map((v) => v.token.identifier.toString()).join(', ')}`,
			);
		}
	};

	public bind: interfaces.BindFunction = <T>(token: Token<T>): interfaces.BindingBuilder<T> => {
		const binding = new BindingBuilder(token, this.config, this.addBinding);
		this.#incompleteBindings.add(binding);

		return binding;
	};

	public unbind: interfaces.UnbindFunction = (token: Token<unknown>): void => {
		const bindings = this.#bindings.flatMap((b) => (b.token.identifier === token.identifier ? [token.identifier] : []));
		if (bindings.length === 0) {
			throw new Error(`Unable to unbind token because it is not bound: ${token.identifier.toString()}`);
		}

		this.#bindings = this.#bindings.filter((b) => !bindings.includes(b.token.identifier));
	};

	public rebind: interfaces.RebindFunction = <T>(token: Token<T>): interfaces.BindingBuilder<T> => {
		this.unbind(token);
		return this.bind(token);
	};

	public load = ((module): void | Promise<void> => {
		return module(this.bind, this.unbind, this.has, this.rebind);
	}) as interfaces.Container['load'];

	public addBinding = <T>(builder: BindingBuilder<T>, binding: Binding<T>): void => {
		this.#incompleteBindings.delete(builder);
		this.#bindings.push(binding);
	};

	#resolveBinding = <T>(binding: Binding<T>): T | Promise<T> => {
		switch (binding.type) {
			case 'static':
				return binding.value;
			case 'dynamic':
				return binding.generator({ container: this, token: binding.token });
			case 'constructor':
				return new binding.ctr();
			default:
				return isNever(binding, 'Unknown binding found');
		}
	};

	public get = async <T>(token: Token<T>): Promise<T> => {
		this.#validateBindings();

		const plan = calculatePlan<T>(this.#bindings, this.#resolveBinding, {
			type: 'request',
			options: {
				multiple: false,
				optional: false,
			},
			token,
		});
		const request: Request<T> = {
			stack: {},
			singletonCache: this.#singletonCache,
			token,
		};

		const lastRequest = Container.#currentRequest;
		try {
			Container.#currentRequest = request;
			return await executePlan(plan, request);
		} finally {
			// eslint-disable-next-line require-atomic-updates
			Container.#currentRequest = lastRequest;
		}
	};

	public has: interfaces.IsBoundFunction = (token) => {
		return this.#bindings.find((b) => b.token.identifier === token.identifier) != null;
	};
}

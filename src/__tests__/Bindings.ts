/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, expect, it, jest } from '@jest/globals';
import { Container } from '../Container.js';
import { Token } from '../Token.js';
import type { TokenType } from '../Token.js';

const token = new Token<{ id: number }>('test');

describe('Bindings', () => {
	it('enforces finalising bindings', async () => {
		const c = new Container();
		c.bind(token);
		c.bind(new Token('foo'));

		await expect(async () => c.get(token)).rejects.toThrowErrorMatchingInlineSnapshot(
			'"Some bindings were started but not completed: Symbol(test), Symbol(foo)"',
		);
	});

	it('throws an error if no binding is found for a token', async () => {
		const c = new Container();

		await expect(async () => c.get(token)).rejects.toThrowErrorMatchingInlineSnapshot(
			'"Unable to resolve token as no bindings exist: Symbol(test)"',
		);
	});

	it('fails if attempting a resolution outside a request', () => {
		expect(() => Container.resolve(token)).toThrowErrorMatchingInlineSnapshot(
			'"Unable to resolve token as no container is currently making a request: Symbol(test)"',
		);
	});

	describe('isProcessingRequest', () => {
		it('can display if a request is running', async () => {
			const c = new Container();
			c.bind(token).toDynamicValue(() => {
				expect(Container.isProcessingRequest).toBe(true);
				return { id: 10 };
			});
			await expect(c.get(token)).resolves.toMatchObject({ id: 10 });
		});

		it('properly ends the current request if it fails', async () => {
			const c = new Container();
			await expect(async () => c.get(token)).rejects.toThrowError();
			expect(Container.isProcessingRequest).toBe(false);
		});
	});

	describe('bind()', () => {
		describe('toConstantValue()', () => {
			it("can't be scoped", () => {
				const c = new Container();
				// @ts-expect-error This error is the actual test
				c.bind(token).inSingletonScope().toConstantValue;
			});

			it('acts like singleton scope', async () => {
				const c = new Container();
				const result = c.bind(token).toConstantValue({ id: 10 });
				expect(result).not.toBeInstanceOf(Promise);
				const resolved = await c.get(token);
				expect(resolved).toMatchObject({ id: 10 });
				expect(resolved).toBe(await c.get(token));
			});

			it('can handle async bindings', async () => {
				const c = new Container();
				const result = c.bind(token).toConstantValue(Promise.resolve({ id: 10 }));
				expect(result).toBeInstanceOf(Promise);
				await result;
				expect(await c.get(token)).toMatchObject({ id: 10 });
			});
		});

		describe('toDynamicValue()', () => {
			it('transient scope will always run the function', async () => {
				const c = new Container();
				const fn = jest.fn<() => TokenType<typeof token>>().mockImplementation(() => ({ id: 10 }));
				c.bind(token).inTransientScope().toDynamicValue(fn);

				expect(await c.get(token)).not.toBe(await c.get(token));
				expect(fn.mock.calls.length).toBe(2);
			});

			it('singleton scope will only run the function once', async () => {
				const c = new Container();
				const fn = jest.fn<() => TokenType<typeof token>>().mockImplementation(() => ({ id: 10 }));
				c.bind(token).inSingletonScope().toDynamicValue(fn);

				const resolved = await c.get(token);
				expect(resolved).toMatchObject({ id: 10 });
				expect(resolved).toBe(await c.get(token));
				expect(fn.mock.calls.length).toBe(1);
			});

			it('can handle nested requests', async () => {
				const c = new Container();
				const subrequest = new Token<string>('subrequest');
				c.bind(token)
					.inSingletonScope()
					.toDynamicValue(async ({ container }) => {
						await expect(container.get(subrequest)).resolves.toBe('Hello world!');
						return { id: 10 };
					});
				c.bind(subrequest).toConstantValue('Hello world!');

				await expect(c.get(token)).resolves.toMatchObject({ id: 10 });
			});

			it('can handle async errors', async () => {
				const c = new Container();
				const subrequest = new Token<string>('subrequest');
				c.bind(token)
					.inSingletonScope()
					.toDynamicValue(async (): Promise<{ id: number }> => {
						return Promise.reject(new Error('Hello, world!'));
					});
				c.bind(subrequest).toConstantValue('Hello world!');

				await expect(c.get(token)).rejects.toThrow('Hello, world!');
			});
		});

		describe('to()', () => {
			it('constructs a new instance', async () => {
				const c = new Container();
				c.bind(token)
					.inSingletonScope()
					.to(
						class {
							public id = 10;
						},
					);

				const resolved = await c.get(token);
				expect(resolved).toMatchObject({ id: 10 });
				expect(resolved).toBe(await c.get(token));
			});
		});
	});

	describe('has()', () => {
		it('can check if a token has been bound', () => {
			const c = new Container();
			c.bind(new Token<undefined>('random.token')).toConstantValue(undefined);
			expect(c.has(token)).toBe(false);
			c.bind(token).toConstantValue({ id: 10 });
			expect(c.has(token)).toBe(true);
		});
	});

	describe('unbind()', () => {
		it('can unbind a token that has been bound', () => {
			const c = new Container();
			const t = new Token<undefined>('random.token');
			c.bind(t).toConstantValue(undefined);
			c.bind(token).toConstantValue({ id: 10 });
			expect(c.has(token)).toBe(true);
			c.unbind(token);
			expect(c.has(token)).toBe(false);
			expect(c.has(t)).toBe(true);
		});

		it('throws an error if the token has not been bound', () => {
			const c = new Container();
			c.bind(new Token<undefined>('random.token')).toConstantValue(undefined);
			expect(() => c.unbind(token)).toThrowErrorMatchingInlineSnapshot(
				'"Unable to unbind token because it is not bound: Symbol(test)"',
			);
		});
	});

	describe('rebind()', () => {
		it('is unbind then bind', async () => {
			const c = new Container();
			c.bind(token).toConstantValue({ id: 10 });
			c.rebind(token).toConstantValue({ id: 20 });

			await expect(c.get(token)).resolves.toMatchObject({ id: 20 });
		});
	});

	describe('load()', () => {
		it('can bind tokens via a module', async () => {
			const c = new Container();
			const value = { id: 10 };
			c.load((bind) => {
				bind(token).toConstantValue(value);
				return undefined;
			});
			await expect(c.get(token)).resolves.toBe(value);
		});

		it('returns the correct types for sync and async loads', async () => {
			const c = new Container();

			c.load(() => {
				/* no op */
			});
			await c.load(async () => {
				/* no op */
			});
		});
	});
});

import type { Injection, InjectionRegistry, PropertyInjection } from '../models/Injection.js';

const registry: InjectionRegistry = new WeakMap();

export const registerInjection = <T>(klass: new () => T, injection: Injection): void => {
	const injections = registry.get(klass) ?? [];
	injections.push(injection);

	registry.set(klass, injections);
};

export const getInjections = <T>(klass: new () => T): Injection[] => {
	const injections: Injection[] = registry.get(klass) ?? [];
	return [...injections];
};

export const getPropertyInjections = <T>(klass: new () => T): PropertyInjection[] => {
	const injections: Injection[] = registry.get(klass) ?? [];
	return [...injections].filter((i): i is PropertyInjection => i.type === 'property');
};

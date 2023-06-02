import { beforeEach, describe, expect, it } from '@jest/globals';
import { Container } from '../Container';
import { inject } from '../decorators/inject';
import { injectable } from '../decorators/injectable';
import { Token } from '../Token';

const LeafToken = new Token<Leaf>('leaf');
@injectable()
class Leaf {}

const NodeToken = new Token<Node>('node');
@injectable()
class Node {
	@inject(LeafToken)
	public left!: Leaf;
	@inject(LeafToken)
	public right!: Leaf;
}

describe('singleton scope', () => {
	let c: Container;

	beforeEach(() => {
		c = new Container({ defaultScope: 'transient' });
		c.bind(LeafToken).inSingletonScope().to(Leaf);
		c.bind(NodeToken).to(Node);
	});

	it('returns the same thing in two requests', () => {
		const first = c.get(LeafToken);
		const second = c.get(LeafToken);

		expect(first).toBe(second);
	});

	it('returns the same thing in the same request', () => {
		const node = c.get(NodeToken);

		expect(node.left).toBe(node.right);
	});
});

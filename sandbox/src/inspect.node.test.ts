import util from 'node:util';
import { describe, expect, test } from 'vitest';
import { format, inspect } from './inspect.ts';

class Point {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}
class Empty {}
class Base {}
class Derived extends Base {}

const circular: Record<string, unknown> = { name: 'a' };
circular.self = circular;
const nullProto = Object.assign(Object.create(null) as object, { a: 1 });
const sparse = [1, , 3]; // eslint-disable-line no-sparse-arrays
const withProp = Object.assign([1, 2], { extra: 'x' });

const values: [string, unknown][] = [
  ['number', 42],
  ['negative zero', -0],
  ['NaN', NaN],
  ['bigint', 10n],
  ['string', 'hi'],
  ['undefined', undefined],
  ['null', null],
  ['symbol', Symbol('s')],
  ['small array', [1, 2, 3]],
  ['six numbers', [1, 2, 3, 4, 5, 6]],
  ['seven numbers', [1, 2, 3, 4, 5, 6, 7]],
  ['many numbers', Array.from({ length: 30 }, (_, i) => i * 7)],
  ['strings array', ['apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape']],
  ['mixed array', [1, 'two', { three: 3 }, [4], null, undefined, true]],
  ['empty array', []],
  ['empty object', {}],
  ['object', { a: 1, b: 'x', c: [1, 2], d: { e: null } }],
  ['quoted keys', { 'a-b': 1, 1: 'one', valid_id: 2 }],
  ['nested deep', { l1: { l2: { l3: { l4: 'deep' } } } }],
  ['long object', { alpha: 'aaaaaaaaaaaa', beta: 'bbbbbbbbbbbbbb', gamma: 'cccccccccccccc', delta: 'dddddddddddd' }],
  ['class instance', new Point(1, 2)],
  ['empty class instance', new Empty()],
  ['map', new Map<unknown, unknown>([['k', 1], [2, { v: true }]])],
  ['empty map', new Map()],
  ['set', new Set([1, 'a'])],
  ['empty set', new Set()],
  ['function', function named() {}],
  ['arrow', () => 1],
  ['async function', async function load() {}],
  ['class', Point],
  ['derived class', Derived],
  ['date', new Date('2026-01-02T03:04:05.000Z')],
  ['regexp', /a+b/gi],
  ['circular', circular],
  ['null prototype', nullProto],
  ['sparse', sparse],
  ['array with prop', withProp],
  ['string with quote', ["it's", 'say "hi"', 'both \' and "']],
  ['escapes', ['a\nb', 'tab\t']],
  ['nested arrays', [[1, 2], [3, [4, [5, [6]]]]]],
  ['array of objects', [{ id: 1, name: 'Ada' }, { id: 2, name: 'Linus' }, { id: 3, name: 'Grace' }]],
  ['getter', Object.defineProperty({}, 'g', { get: () => 1, enumerable: true })],
  ['typed array', new Uint8Array([1, 2, 3])],
  ['symbol key', { [Symbol('k')]: 1 }],
  ['big array', Array.from({ length: 120 }, (_, i) => i)],
];

describe('inspect 与 Node util.inspect 一致', () => {
  test.each(values)('%s', (_name, value) => {
    expect(inspect(value)).toBe(util.inspect(value));
  });
});

describe('format 与 Node util.format 一致', () => {
  const cases: unknown[][] = [
    ['hello'],
    ['a', 'b', 1],
    [1, 2, 'x'],
    ['%s is %d years', 'Ada', 36],
    ['%s', { a: 1 }],
    ['%i %f', '42.9px', '3.5'],
    ['%j', { a: [1] }],
    ['100%%', 'extra'],
    ['%s and %s', 'only one'],
    ['no placeholders', { a: 1 }, [2]],
    ['%c styled', 'color: red'],
    [{ a: 1 }, 'tail'],
    ['%d', 10n],
    ['%s', -0],
  ];
  test.each(cases)('%j', (...args) => {
    expect(format(...args)).toBe(util.format(...args));
  });
});

test('错误对象显示为 name: message', () => {
  expect(inspect(new TypeError('bad'))).toBe('TypeError: bad');
});

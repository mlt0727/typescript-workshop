/**
 * 深比较，语义参照 Vitest：
 * - toEqual：递归比较；忽略值为 undefined 的属性；不比较对象的原型/类；
 * - toStrictEqual：额外检查 undefined 属性、数组空位与原型是否相同。
 */
export function equals(a: unknown, b: unknown, strict: boolean, seen = new Map<object, object>()): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

  if (seen.get(a) === b) return true;
  seen.set(a, b);

  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;

  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && Object.is(a.getTime(), b.getTime());
  }
  if (a instanceof RegExp || b instanceof RegExp) {
    return a instanceof RegExp && b instanceof RegExp && a.source === b.source && a.flags === b.flags;
  }
  if (a instanceof Error || b instanceof Error) {
    if (!(a instanceof Error && b instanceof Error)) return false;
    if (a.name !== b.name || a.message !== b.message) return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map && b instanceof Map) || a.size !== b.size) return false;
    for (const [k, v] of a) {
      if (!b.has(k)) {
        let found = false;
        for (const [k2, v2] of b) {
          if (equals(k, k2, strict, seen) && equals(v, v2, strict, seen)) {
            found = true;
            break;
          }
        }
        if (!found) return false;
      } else if (!equals(v, b.get(k), strict, seen)) {
        return false;
      }
    }
    return true;
  }
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set && b instanceof Set) || a.size !== b.size) return false;
    outer: for (const v of a) {
      if (b.has(v)) continue;
      for (const v2 of b) if (equals(v, v2, strict, seen)) continue outer;
      return false;
    }
    return true;
  }
  if (typeof Node !== 'undefined' && (a instanceof Node || b instanceof Node)) {
    return a instanceof Node && b instanceof Node && a.isEqualNode(b);
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (strict && Object.hasOwn(a, i) !== Object.hasOwn(b, i)) return false;
      if (!equals(a[i], b[i], strict, seen)) return false;
    }
  }

  const keysA = ownKeys(a, strict);
  const keysB = ownKeys(b, strict);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!equals((a as Record<PropertyKey, unknown>)[key], (b as Record<PropertyKey, unknown>)[key], strict, seen)) {
      return false;
    }
  }
  return true;
}

function ownKeys(obj: object, strict: boolean): PropertyKey[] {
  const isArr = Array.isArray(obj);
  const keys: PropertyKey[] = Object.keys(obj).filter((k) => !(isArr && /^(0|[1-9]\d*)$/.test(k)));
  for (const s of Object.getOwnPropertySymbols(obj)) {
    if (Object.prototype.propertyIsEnumerable.call(obj, s)) keys.push(s);
  }
  if (strict) return keys;
  return keys.filter((k) => (obj as Record<PropertyKey, unknown>)[k] !== undefined);
}

/** toMatchObject：expected 中的每个属性都要在 actual 中递归匹配。 */
export function matchesObject(actual: unknown, expected: unknown, seen = new Set<object>()): boolean {
  if (typeof expected !== 'object' || expected === null) return equals(actual, expected, false);
  if (typeof actual !== 'object' || actual === null) return false;
  if (seen.has(expected)) return true;
  seen.add(expected);
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) return false;
    return expected.every((e, i) => matchesObject(actual[i], e, seen));
  }
  if (expected instanceof Date || expected instanceof RegExp || expected instanceof Map || expected instanceof Set) {
    return equals(actual, expected, false);
  }
  return Object.keys(expected).every(
    (k) => k in actual && matchesObject((actual as Record<string, unknown>)[k], (expected as Record<string, unknown>)[k], seen),
  );
}

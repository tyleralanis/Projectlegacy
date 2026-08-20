export function seedToUint32(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 0x6d2b79f5;
}

export function nextRandom(state: number): { value: number; state: number } {
  const nextState = (state + 0x6d2b79f5) >>> 0;
  let value = nextState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return { value: ((value ^ (value >>> 14)) >>> 0) / 4294967296, state: nextState };
}

export function randomBetween(state: number, minimum: number, maximum: number): { value: number; state: number } {
  const next = nextRandom(state);
  return { value: minimum + (maximum - minimum) * next.value, state: next.state };
}

export function randomInt(state: number, minimum: number, maximum: number): { value: number; state: number } {
  const next = nextRandom(state);
  return { value: Math.floor(minimum + next.value * (maximum - minimum + 1)), state: next.state };
}

export function chooseSeeded<T>(state: number, values: readonly T[]): { value: T; state: number } {
  if (values.length === 0) {
    throw new Error('Cannot choose from an empty collection.');
  }
  const selected = randomInt(state, 0, values.length - 1);
  return { value: values[selected.value], state: selected.state };
}

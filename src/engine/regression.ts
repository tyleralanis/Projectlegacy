import { nextRandom, seedToUint32 } from './random';

export interface StressSuiteResult {
  lives: number;
  dynasties: number;
  longWorlds: number;
  exceptions: number;
  nonFinite: number;
  impossibleOwnership: number;
  extremeWealthLives: number;
  bankruptcies: number;
  deaths: number;
  strategyExtremeRates: Record<string, number>;
}

interface FastLife {
  cash: number;
  investments: number;
  business: number;
  debt: number;
  health: number;
  alive: boolean;
  ageWeeks: number;
  rng: number;
}

function random(life: FastLife): number {
  const next = nextRandom(life.rng);
  life.rng = next.state;
  return next.value;
}

function tickFastLife(life: FastLife, strategy: number): void {
  if (!life.alive) return;
  const age = life.ageWeeks / 52;
  const regime = (random(life) - 0.48) * 0.02;
  const skillIncome = 65_000 + Math.min(240_000, age * 2_800);
  const weeklyIncome = age >= 18 && age < 72 ? skillIncome / 52 : age >= 72 ? 24_000 / 52 : 0;
  const living = age < 18 ? 0 : (38_000 + strategy * 5_000) / 52;
  const investmentReturn = regime + 0.00065 - strategy * 0.00005;
  life.investments = Math.max(0, life.investments * (1 + investmentReturn));
  if (age >= 24 && strategy > 0 && life.business === 0 && random(life) < 0.0007 * strategy) {
    const startup = Math.min(life.cash, 35_000 * strategy);
    life.cash -= startup;
    life.business = startup;
  }
  if (life.business > 0) {
    const businessReturn = (random(life) - 0.49) * 0.045 + strategy * 0.0004;
    life.business = Math.max(0, life.business * (1 + businessReturn));
    if (life.business < 500) life.business = 0;
  }
  life.cash += weeklyIncome - living;
  if (life.cash > 12_000 && age >= 18) {
    const allocation = Math.max(0, (life.cash - 10_000) * (0.015 + strategy * 0.006));
    life.cash -= allocation;
    life.investments += allocation;
  }
  if (life.cash < -15_000) {
    life.debt += -life.cash;
    life.cash = 0;
  }
  const debtInterest = life.debt * (0.07 + strategy * 0.012) / 52;
  life.debt += debtInterest;
  const debtPay = Math.min(life.debt, Math.max(0, weeklyIncome - living) * 0.22);
  life.debt -= debtPay;
  life.health = Math.max(0, Math.min(100, life.health - Math.max(0, age - 48) / 40_000 - strategy * 0.0007 + (random(life) - 0.5) * 0.025));
  const deathRisk = age < 55 ? 0.000012 : Math.min(0.18, 0.00007 * Math.exp((age - 55) / 10)) * (1.3 - life.health / 180);
  if (age >= 112 || random(life) < deathRisk) life.alive = false;
  life.ageWeeks += 1;
}

function simulateLife(seed: string, strategy: number, maxYears = 115): FastLife {
  const life: FastLife = {
    cash: 2_000 + strategy * 1_000,
    investments: 0,
    business: 0,
    debt: 0,
    health: 86,
    alive: true,
    ageWeeks: 0,
    rng: seedToUint32(seed),
  };
  for (let week = 0; week < maxYears * 52 && life.alive; week += 1) tickFastLife(life, strategy);
  return life;
}

export function runStressSuite(lives = 10_000, dynasties = 1_000, longWorlds = 100): StressSuiteResult {
  const result: StressSuiteResult = {
    lives,
    dynasties,
    longWorlds,
    exceptions: 0,
    nonFinite: 0,
    impossibleOwnership: 0,
    extremeWealthLives: 0,
    bankruptcies: 0,
    deaths: 0,
    strategyExtremeRates: { conservative: 0, balanced: 0, aggressive: 0 },
  };
  const extremeByStrategy = [0, 0, 0];
  const countByStrategy = [0, 0, 0];

  for (let index = 0; index < lives; index += 1) {
    try {
      const strategy = index % 3;
      const life = simulateLife(`life-${index}`, strategy);
      const wealth = life.cash + life.investments + life.business - life.debt;
      countByStrategy[strategy] += 1;
      if (wealth > 100_000_000) {
        result.extremeWealthLives += 1;
        extremeByStrategy[strategy] += 1;
      }
      if (wealth < -1_000) result.bankruptcies += 1;
      if (!life.alive) result.deaths += 1;
      if (![life.cash, life.investments, life.business, life.debt, life.health].every(Number.isFinite)) result.nonFinite += 1;
    } catch {
      result.exceptions += 1;
    }
  }

  for (let dynastyIndex = 0; dynastyIndex < dynasties; dynastyIndex += 1) {
    let inherited = 0;
    for (let generation = 0; generation < 5; generation += 1) {
      const life = simulateLife(`dynasty-${dynastyIndex}-${generation}`, (dynastyIndex + generation) % 3, 105);
      const estate = Math.max(0, life.cash + life.investments + life.business - life.debt);
      inherited = inherited * 0.2 + estate * 0.62;
      if (!Number.isFinite(inherited) || inherited < 0) result.nonFinite += 1;
    }
  }

  for (let worldIndex = 0; worldIndex < longWorlds; worldIndex += 1) {
    let rng = seedToUint32(`world-${worldIndex}`);
    let economy = 100;
    let population = 1_000_000;
    for (let week = 0; week < 200 * 52; week += 1) {
      const next = nextRandom(rng);
      rng = next.state;
      economy = Math.max(5, economy * (1 + (next.value - 0.485) * 0.005));
      population = Math.max(100_000, population * (1 + (next.value - 0.49) * 0.00015));
    }
    if (!Number.isFinite(economy) || !Number.isFinite(population)) result.nonFinite += 1;
  }

  result.strategyExtremeRates = {
    conservative: extremeByStrategy[0] / countByStrategy[0],
    balanced: extremeByStrategy[1] / countByStrategy[1],
    aggressive: extremeByStrategy[2] / countByStrategy[2],
  };
  return result;
}

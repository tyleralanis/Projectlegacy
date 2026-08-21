import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const catalogSource = read('src/content/lifeSystemsActionCatalog.ts');
const engineSource = read('src/engine/lifeSystemsDepth.ts');
const delegationSource = read('src/engine/delegationDepth.ts');
const financeEducationSource = read('src/engine/financeEducationPolish.ts');
const ageProgressionSource = read('src/engine/ageProgressionWorld.ts');
const wealthLifestyleSource = read('src/engine/wealthLifestyle.ts');
const propertyPolishSource = read('src/engine/propertyPolishActions.ts');
const bridgeSource = read('src/engine/supplementalDepthBridge.ts');
const providerSource = read('src/state/GameProvider.tsx');
const intentBridgeSource = read('src/services/lifeIntentBridge.ts');
const composerSource = read('src/components/OtherActionComposer.tsx');

const actionIds = [...catalogSource.matchAll(/\{ id: '([^']+)'/g)].map((match) => match[1]);
if (actionIds.length === 0) throw new Error('Life-system action catalog is empty.');
if (new Set(actionIds).size !== actionIds.length) throw new Error('Life-system action catalog contains duplicate IDs.');

const declaredVerbs = new Set(
  [engineSource, delegationSource, financeEducationSource]
    .flatMap((source) => [...source.matchAll(/'([a-z]+\.[a-z_]+)'/g)].map((match) => match[1])),
);
const missingHandlers = actionIds.filter((id) => !declaredVerbs.has(id));
if (missingHandlers.length > 0) throw new Error(`Life-system actions are missing engine handlers: ${missingHandlers.join(', ')}`);

if (!bridgeSource.includes('executeLifeSystemsDepth(source, action)')) throw new Error('Supplemental bridge is not routing actions through lifeSystemsDepth.');
if (!bridgeSource.includes('executeDelegationDepth(source, action)')) throw new Error('Supplemental bridge is not routing portfolio/CEO actions through delegationDepth.');
if (!bridgeSource.includes('executeFinanceEducationPolish(source, action, confirmed)')) throw new Error('Supplemental bridge is not routing finance and education actions through financeEducationPolish.');
if (!bridgeSource.includes('executeWealthLifestyleAction(source, action)')) throw new Error('Supplemental bridge is not routing license, luxury, and charitable actions.');
if (!bridgeSource.includes('executePropertyPolishAction(source, action)')) throw new Error('Supplemental bridge is not routing contextual property actions.');
if (!bridgeSource.includes('prepareAgeProgressionAdvance(before, after)')) throw new Error('Supplemental bridge is not applying age rules before recurring systems.');
if (!bridgeSource.includes('prepareDelegationAdvance(before, aged)')) throw new Error('Supplemental bridge is not preparing recurring delegated state after age normalization.');
if (!bridgeSource.includes('applyAgeProgressionAdvance(before, base)')) throw new Error('Supplemental bridge is not advancing age and caregiver systems.');
if (!bridgeSource.includes('applyWealthLifestyleAdvance(before, ageProgressed)')) throw new Error('Supplemental bridge is not advancing licenses and personal assets.');
if (!bridgeSource.includes('applyLifeSystemsAdvance(before, lifestyle)')) throw new Error('Supplemental bridge is not advancing recurring life systems after lifestyle costs.');
if (!bridgeSource.includes('applyDelegationAdvance(before, life)')) throw new Error('Supplemental bridge is not advancing delegated portfolio and CEO systems.');
if (!bridgeSource.includes('applyFinanceEducationAdvance(before, legal)')) throw new Error('Supplemental bridge is not advancing finance and education polish.');
if (!providerSource.includes("from '@/engine/supplementalDepthBridge'")) throw new Error('GameProvider is not using the systemic supplemental bridge.');
if (!composerSource.includes("from '@/services/lifeIntentBridge'")) throw new Error('OtherActionComposer is not using the systemic intent bridge.');

for (const sourceCheck of [
  [ageProgressionSource, 'normalizeAgeProgressionState('],
  [ageProgressionSource, 'caregiverAvailability('],
  [wealthLifestyleSource, 'license.start_driver_training'],
  [wealthLifestyleSource, 'license.start_pilot_training'],
  [wealthLifestyleSource, 'charity.donate'],
  [propertyPolishSource, 'renovationOptionsForProperty('],
]) {
  if (!sourceCheck[0].includes(sourceCheck[1])) throw new Error(`Age-aware life-system source is missing ${sourceCheck[1]}.`);
}

const aliasKeys = new Set([...intentBridgeSource.matchAll(/^\s*'([^']+)'\s*:/gm)].map((match) => match[1]));
const missingAliases = actionIds.filter((id) => !aliasKeys.has(id));
if (missingAliases.length > 0) throw new Error(`Life-system actions are missing deterministic free-form aliases: ${missingAliases.join(', ')}`);

const requiredRecurringFunctions = [
  'processLifestyle',
  'processAdvisorRenewals',
  'processPropertyRelationships',
  'processSportsCareer',
  'processHealthPressure',
  'completeNpcEducation',
];
for (const name of requiredRecurringFunctions) {
  if (!engineSource.includes(`${name}(`)) throw new Error(`Life-system advance is missing ${name}.`);
}

for (const name of ['prepareDelegationAdvance', 'maintainManagedPortfolio', 'autoManageBusiness', 'handleDelegatedEvents']) {
  if (!delegationSource.includes(`${name}(`)) throw new Error(`Delegation advance is missing ${name}.`);
}

console.log(`Validated ${actionIds.length} OTA life-system actions, deterministic aliases, authoritative handlers, age-aware progression, lifestyle depth, property routing, delegation routing, and recurring simulation passes.`);

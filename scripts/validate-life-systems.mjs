import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const catalogSource = read('src/content/lifeSystemsActionCatalog.ts');
const engineSource = read('src/engine/lifeSystemsDepth.ts');
const bridgeSource = read('src/engine/supplementalDepthBridge.ts');
const providerSource = read('src/state/GameProvider.tsx');
const intentBridgeSource = read('src/services/lifeIntentBridge.ts');
const composerSource = read('src/components/OtherActionComposer.tsx');

const actionIds = [...catalogSource.matchAll(/\{ id: '([^']+)'/g)].map((match) => match[1]);
if (actionIds.length === 0) throw new Error('Life-system action catalog is empty.');
if (new Set(actionIds).size !== actionIds.length) throw new Error('Life-system action catalog contains duplicate IDs.');

const declaredVerbs = new Set([...engineSource.matchAll(/'([a-z]+\.[a-z_]+)'/g)].map((match) => match[1]));
const missingHandlers = actionIds.filter((id) => !declaredVerbs.has(id));
if (missingHandlers.length > 0) throw new Error(`Life-system actions are missing engine handlers: ${missingHandlers.join(', ')}`);

if (!bridgeSource.includes('executeLifeSystemsDepth(source, action)')) throw new Error('Supplemental bridge is not routing actions through lifeSystemsDepth.');
if (!bridgeSource.includes('applyLifeSystemsAdvance(before, base)')) throw new Error('Supplemental bridge is not advancing recurring life systems.');
if (!providerSource.includes("from '@/engine/supplementalDepthBridge'")) throw new Error('GameProvider is not using the systemic supplemental bridge.');
if (!composerSource.includes("from '@/services/lifeIntentBridge'")) throw new Error('OtherActionComposer is not using the systemic intent bridge.');

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

console.log(`Validated ${actionIds.length} OTA life-system actions, deterministic aliases, authoritative handlers, bridge routing, and recurring simulation passes.`);

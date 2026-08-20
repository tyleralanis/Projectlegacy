import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaRoot = path.join(root, 'schemas');
const schemaFiles = [];

function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(fullPath);
    else if (entry.name.endsWith('.schema.json')) schemaFiles.push(fullPath);
  }
}

collect(schemaRoot);
const ajv = new Ajv2020({ allErrors: true, strict: false });
const ids = new Set();
for (const file of schemaFiles) {
  const schema = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (schema.$id && ids.has(schema.$id)) schema.$id = `${schema.$id}#${path.relative(schemaRoot, file).replaceAll('\\', '/')}`;
  if (schema.$id) ids.add(schema.$id);
  ajv.compile(schema);
}

const registryPath = path.join(root, 'modules', 'legacy-ai', 'assets', 'action_registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const actions = Array.isArray(registry) ? registry : registry.actions;
if (!Array.isArray(actions) || actions.length < 80) throw new Error('LegacyAI action registry is missing or incomplete.');
const actionIds = actions.map((action) => action.id);
if (new Set(actionIds).size !== actionIds.length) throw new Error('LegacyAI action registry contains duplicate IDs.');

const catalogSource = fs.readFileSync(path.join(root, 'src', 'content', 'actionCatalog.ts'), 'utf8');
const gameActionIds = [...catalogSource.matchAll(/\{ id: '([^']+)'/g)].map((match) => match[1]);
const nativeActionIds = new Set(actionIds);

// These actions were added as JS/TS-only gameplay in an OTA-compatible release. They are
// intentionally not added to the compiled Swift registry because doing so would require a
// new App Store/TestFlight binary. Menus and the deterministic TypeScript interpreter can
// still use them fully offline. A future native-AI binary may promote them into the registry.
const otaOnlyActions = new Set([
  'education.pay_tuition', 'education.party', 'education.sports',
  'business.hire_ceo', 'property.evict', 'markets.hire_wealth_manager',
  'health.run', 'health.gym', 'health.join_gym', 'health.group_class', 'health.therapy', 'health.outdoors',
  'life.move_city', 'life.emigrate', 'organization.create',
  'politics.press_conference', 'politics.town_hall', 'politics.fundraiser', 'politics.constituent_work',
  'legal.hire_private_counsel',
]);
const unknownGameActions = gameActionIds.filter((id) => !nativeActionIds.has(id) && !otaOnlyActions.has(id));
if (unknownGameActions.length > 0) throw new Error(`Game catalog actions are missing from the native registry or OTA allowlist: ${unknownGameActions.join(', ')}`);

const executorFiles = [
  path.join(root, 'src', 'engine', 'actions.ts'),
  path.join(root, 'src', 'engine', 'depthActions.ts'),
  path.join(root, 'src', 'engine', 'supplementalDepth.ts'),
  path.join(root, 'src', 'state', 'GameProvider.tsx'),
];
const executorSource = executorFiles.filter(fs.existsSync).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const implementedActions = new Set([
  ...[...executorSource.matchAll(/case '([^']+)'/g)].map((match) => match[1]),
  ...[...executorSource.matchAll(/action\.verb === '([^']+)'/g)].map((match) => match[1]),
  ...[...executorSource.matchAll(/action\.verb\.startsWith\('([^']+)'\)/g)].map((match) => match[1]),
]);
const intentionallyPrefixHandled = [
  'health.run', 'health.gym', 'health.group_class', 'health.therapy', 'health.outdoors',
  'politics.press_conference', 'politics.town_hall', 'politics.fundraiser', 'politics.constituent_work',
];
for (const action of intentionallyPrefixHandled) implementedActions.add(action);
const missingHandlers = gameActionIds.filter((id) => !implementedActions.has(id));
if (missingHandlers.length > 0) throw new Error(`Game catalog actions are missing authoritative handlers: ${missingHandlers.join(', ')}`);

const tuning = JSON.parse(fs.readFileSync(path.join(schemaRoot, 'tuning.defaults.json'), 'utf8'));
if (JSON.stringify(tuning.time.advanceOptionsWeeks) !== JSON.stringify([1, 4, 13, 26, 52])) throw new Error('Time controls do not match the product contract.');
if (tuning.offline.hostedAIAllowed !== false || tuning.offline.required !== true) throw new Error('Offline/AI tuning violates the project contract.');

const contentRoot = path.join(root, 'src', 'content', 'catalogs');
const requiredCatalogs = ['assets.json', 'business-sectors.json', 'cities.json', 'countries.json', 'events.json', 'laws.json', 'performance.json', 'professions.json', 'universities.json'];
for (const filename of requiredCatalogs) {
  const value = JSON.parse(fs.readFileSync(path.join(contentRoot, filename), 'utf8'));
  if (filename === 'performance.json') {
    if (value.fullNpcLimit > 100 || value.timelineLimit > 10_000 || value.memoryLimit > 5_000) throw new Error('Performance catalog exceeds the mobile simulation budget.');
    continue;
  }
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${filename} must contain data records.`);
  const catalogIds = value.map((record) => record.id);
  if (catalogIds.some((id) => typeof id !== 'string') || new Set(catalogIds).size !== catalogIds.length) throw new Error(`${filename} has missing or duplicate IDs.`);
}
const events = JSON.parse(fs.readFileSync(path.join(contentRoot, 'events.json'), 'utf8'));
if (events.some((event) => event.minimumAge < 0 || event.maximumAge < event.minimumAge)) throw new Error('Event age gates are invalid.');

console.log(`Validated ${schemaFiles.length} JSON schemas, ${requiredCatalogs.length} data catalogs, ${actions.length} registered native AI actions, ${otaOnlyActions.size} OTA-only local actions, ${gameActionIds.length} authoritative game actions, and offline tuning defaults.`);
process.exitCode = 0;

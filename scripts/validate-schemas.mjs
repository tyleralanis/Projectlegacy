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

const catalogSources = [
  path.join(root, 'src', 'content', 'actionCatalog.ts'),
  path.join(root, 'src', 'content', 'depthActionCatalog.ts'),
].filter(fs.existsSync).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const gameActionIds = [...catalogSources.matchAll(/\{ id: '([^']+)'/g)].map((match) => match[1]);
if (new Set(gameActionIds).size !== gameActionIds.length) throw new Error('Game action catalogs contain duplicate IDs.');
const nativeActionIds = new Set(actionIds);

// TypeScript-only gameplay actions can ship through a compatible Expo update without
// changing the compiled Swift intent registry. They remain local/offline and authoritative:
// the interpreter proposes structured intents, and the deterministic game engine validates
// and mutates the world. Additions here must also have a real handler below.
const otaOnlyActions = new Set([
  'education.pay_tuition', 'education.party', 'education.sports',
  'business.hire_ceo', 'property.evict', 'markets.hire_wealth_manager',
  'health.run', 'health.gym', 'health.join_gym', 'health.group_class', 'health.therapy', 'health.outdoors',
  'life.move_city', 'life.emigrate', 'organization.create',
  'politics.press_conference', 'politics.town_hall', 'politics.fundraiser', 'politics.constituent_work',
  'legal.hire_private_counsel',
  'relationship.prioritize', 'relationship.deep_talk', 'relationship.check_in', 'relationship.apologize', 'relationship.forgive',
  'relationship.celebrate', 'relationship.date_night', 'relationship.weekend_away', 'relationship.support_goal', 'relationship.ask_favor',
  'relationship.lend_money', 'relationship.collect_loan', 'relationship.set_boundary', 'relationship.one_on_one', 'relationship.reminisce',
  'relationship.plan_future', 'relationship.introduce_network',
  'family.family_dinner', 'family.help_school', 'family.teach_money', 'family.attend_event', 'family.caregiving', 'family.set_expectations',
  'family.invite_business', 'family.discuss_inheritance',
  'markets.research', 'markets.set_strategy', 'markets.rebalance',
  'business.set_growth_posture', 'business.invest_quality', 'business.invest_rd', 'business.reward_staff', 'business.expand_location',
  'education.choose_major', 'education.office_hours', 'education.join_club', 'education.internship', 'education.sports_train', 'education.sports_compete', 'education.sports_seek_scholarship',
  'career.work_hard', 'career.network', 'career.train', 'career.seek_promotion', 'career.office_politics',
  'organization.found_inner_circle', 'faction.set_archetype', 'faction.recruit', 'faction.hold_gathering', 'faction.collect_contributions',
  'faction.buy_land', 'faction.spread_doctrine', 'faction.elevate_leader', 'faction.adopt_plural_household', 'faction.invite_plural_spouse',
  'faction.build_security', 'faction.expand_public_influence', 'faction.member_welfare', 'faction.attempt_power_seizure',

  'skills.practice',
  'markets.private_deal',
  'business.add_product', 'business.improve_product', 'business.retire_product', 'business.acquire_company',
  'education.add_minor', 'education.research_project', 'education.find_mentor',
  'sports.choose_sport', 'sports.practice', 'sports.compete', 'sports.seek_agent',
  'career.find_mentor', 'career.take_lead', 'career.build_alliance',
  'dynasty.family_council', 'dynasty.train_heir',
  'politics.build_coalition', 'politics.recruit_staff',
]);
const unknownGameActions = gameActionIds.filter((id) => !nativeActionIds.has(id) && !otaOnlyActions.has(id));
if (unknownGameActions.length > 0) throw new Error(`Game catalog actions are missing from the native registry or OTA allowlist: ${unknownGameActions.join(', ')}`);

const executorFiles = [
  path.join(root, 'src', 'engine', 'actions.ts'),
  path.join(root, 'src', 'engine', 'depthActions.ts'),
  path.join(root, 'src', 'engine', 'supplementalDepth.ts'),
  path.join(root, 'src', 'engine', 'relationshipDepth.ts'),
  path.join(root, 'src', 'engine', 'trackDepth.ts'),
  path.join(root, 'src', 'engine', 'factionDepth.ts'),
  path.join(root, 'src', 'engine', 'deepSimulationActions.ts'),
  path.join(root, 'src', 'state', 'GameProvider.tsx'),
];
const executorSource = executorFiles.filter(fs.existsSync).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const implementedActions = new Set([
  ...[...executorSource.matchAll(/case '([^']+)'/g)].map((match) => match[1]),
  ...[...executorSource.matchAll(/action\.verb === '([^']+)'/g)].map((match) => match[1]),
  ...[...executorSource.matchAll(/'([a-z]+\.[a-z_]+)'/g)].map((match) => match[1]).filter((id) => otaOnlyActions.has(id)),
]);
const intentionallyPrefixHandled = [
  'health.run', 'health.gym', 'health.group_class', 'health.therapy', 'health.outdoors',
  'politics.press_conference', 'politics.town_hall', 'politics.fundraiser', 'politics.constituent_work',
  'faction.attempt_power_seizure',
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

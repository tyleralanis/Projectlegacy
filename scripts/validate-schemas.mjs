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
const unknownGameActions = gameActionIds.filter((id) => !nativeActionIds.has(id));
if (unknownGameActions.length > 0) throw new Error(`Game catalog actions are missing from the native registry: ${unknownGameActions.join(', ')}`);

const executorSource = fs.readFileSync(path.join(root, 'src', 'engine', 'actions.ts'), 'utf8');
const implementedActions = new Set([...executorSource.matchAll(/case '([^']+)'/g)].map((match) => match[1]));
const missingHandlers = gameActionIds.filter((id) => !implementedActions.has(id));
if (missingHandlers.length > 0) throw new Error(`Game catalog actions are missing authoritative handlers: ${missingHandlers.join(', ')}`);

const tuning = JSON.parse(fs.readFileSync(path.join(schemaRoot, 'tuning.defaults.json'), 'utf8'));
if (JSON.stringify(tuning.time.advanceOptionsWeeks) !== JSON.stringify([1, 4, 13, 26, 52])) throw new Error('Time controls do not match the product contract.');
if (tuning.offline.hostedAIAllowed !== false || tuning.offline.required !== true) throw new Error('Offline/AI tuning violates the project contract.');

const contentRoot = path.join(root, 'src', 'content', 'catalogs');
const requiredCatalogs = ['assets.json', 'business-sectors.json', 'countries.json', 'events.json', 'laws.json', 'performance.json', 'professions.json', 'universities.json'];
for (const filename of requiredCatalogs) {
  const value = JSON.parse(fs.readFileSync(path.join(contentRoot, filename), 'utf8'));
  if (filename === 'performance.json') {
    if (value.fullNpcLimit > 100 || value.timelineLimit > 10_000 || value.memoryLimit > 5_000) throw new Error('Performance catalog exceeds the mobile simulation budget.');
    continue;
  }
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${filename} must contain data records.`);
  const ids = value.map((record) => record.id);
  if (ids.some((id) => typeof id !== 'string') || new Set(ids).size !== ids.length) throw new Error(`${filename} has missing or duplicate IDs.`);
}
const events = JSON.parse(fs.readFileSync(path.join(contentRoot, 'events.json'), 'utf8'));
if (events.some((event) => event.minimumAge < 0 || event.maximumAge < event.minimumAge)) throw new Error('Event age gates are invalid.');

console.log(`Validated ${schemaFiles.length} JSON schemas, ${requiredCatalogs.length} data catalogs, ${actions.length} registered local AI actions, ${gameActionIds.length} authoritative game actions, and offline tuning defaults.`);
process.exitCode = 0;

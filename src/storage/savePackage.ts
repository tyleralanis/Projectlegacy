import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import { LATEST_SCHEMA_VERSION } from './migrations';

import { assertWorldValid } from '@/engine/invariants';
import type { WorldState } from '@/engine/types';


export interface SaveManifest {
  saveId: string;
  schemaVersion: number;
  engineVersion: string;
  contentVersion: string;
  worldSeed: string;
  createdAt: string;
  exportedAt: string;
  databaseFile: string;
  checksum: string;
  displaySummary: {
    playerName: string;
    generation: number;
    week: number;
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunk, bytes.length)));
  }
  return globalThis.btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function checksumWorld(worldJSON: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, worldJSON);
}

export async function createSaveArchive(world: WorldState): Promise<{ bytes: Uint8Array; manifest: SaveManifest }> {
  assertWorldValid(world);
  const worldJSON = JSON.stringify(world);
  const checksum = await checksumWorld(worldJSON);
  const active = world.characters[world.playerCharacterId];
  const manifest: SaveManifest = {
    saveId: world.metadata.saveId,
    schemaVersion: world.metadata.schemaVersion,
    engineVersion: world.metadata.engineVersion,
    contentVersion: world.metadata.contentVersion,
    worldSeed: world.metadata.worldSeed,
    createdAt: world.metadata.createdAt,
    exportedAt: new Date().toISOString(),
    databaseFile: 'world.json',
    checksum,
    displaySummary: {
      playerName: `${active.firstName} ${active.lastName}`,
      generation: world.dynasty.generation,
      week: world.calendar.week,
    },
  };
  return {
    bytes: zipSync({
      'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
      'world.json': strToU8(worldJSON),
    }, { level: 6 }),
    manifest,
  };
}

export async function exportSavePackage(world: WorldState): Promise<string> {
  const archive = await createSaveArchive(world);
  const directory = FileSystem.cacheDirectory;
  if (!directory) throw new Error('The device cache directory is unavailable.');
  const path = `${directory}${world.metadata.saveId}-${Date.now()}.legacy`;
  await FileSystem.writeAsStringAsync(path, bytesToBase64(archive.bytes), { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: 'application/zip', dialogTitle: 'Export Project Legacy save', UTI: 'public.zip-archive' });
  }
  return path;
}

export async function decodeSaveArchive(bytes: Uint8Array): Promise<WorldState> {
  const archive = unzipSync(bytes);
  const manifestBytes = archive['manifest.json'];
  const worldBytes = archive['world.json'];
  if (!manifestBytes || !worldBytes) throw new Error('The selected file is not a Project Legacy save package.');
  const manifest = JSON.parse(strFromU8(manifestBytes)) as SaveManifest;
  const worldJSON = strFromU8(worldBytes);
  if (manifest.databaseFile !== 'world.json') throw new Error('The save manifest points to an unsupported data file.');
  if (manifest.schemaVersion > LATEST_SCHEMA_VERSION) throw new Error('This save was created by a newer version of Project Legacy.');
  if ((await checksumWorld(worldJSON)) !== manifest.checksum) throw new Error('The save checksum does not match. The file may be damaged.');
  const world = JSON.parse(worldJSON) as WorldState;
  if (world.metadata.saveId !== manifest.saveId || world.metadata.worldSeed !== manifest.worldSeed) throw new Error('The save manifest and world data do not agree.');
  if (manifest.schemaVersion === LATEST_SCHEMA_VERSION) assertWorldValid(world);
  return world;
}

export async function importSavePackage(): Promise<WorldState> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/zip', 'application/octet-stream'], copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) throw new Error('Import canceled.');
  const encoded = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
  return decodeSaveArchive(base64ToBytes(encoded));
}

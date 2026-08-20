import { Platform } from 'react-native';

export interface UpdateSnapshot {
  enabled: boolean;
  channel: string;
  runtimeVersion: string;
  updateId?: string;
  available: boolean;
  downloaded: boolean;
  message: string;
}

export async function getUpdateSnapshot(): Promise<UpdateSnapshot> {
  if (Platform.OS === 'web') return { enabled: false, channel: 'web', runtimeVersion: 'web', available: false, downloaded: false, message: 'Web releases update through deployment.' };
  const Updates = await import('expo-updates');
  return {
    enabled: Updates.isEnabled,
    channel: Updates.channel ?? 'embedded',
    runtimeVersion: Updates.runtimeVersion ?? 'unknown',
    updateId: Updates.updateId ?? undefined,
    available: false,
    downloaded: false,
    message: Updates.isEnabled ? 'The embedded game is ready. Online checks never block offline play.' : 'OTA updates are unavailable in this development environment.',
  };
}

export async function checkAndDownloadUpdate(): Promise<UpdateSnapshot> {
  const base = await getUpdateSnapshot();
  if (!base.enabled || Platform.OS === 'web') return base;
  const Updates = await import('expo-updates');
  const check = await Updates.checkForUpdateAsync();
  if (!check.isAvailable) return { ...base, message: 'This device already has the newest compatible game update.' };
  await Updates.fetchUpdateAsync();
  return { ...base, available: true, downloaded: true, message: 'A compatible update is downloaded and ready to apply.' };
}

export async function applyDownloadedUpdate(): Promise<void> {
  if (Platform.OS === 'web') return;
  const Updates = await import('expo-updates');
  await Updates.reloadAsync();
}

export async function stageUpdateWithoutBlocking(): Promise<void> {
  try {
    await checkAndDownloadUpdate();
  } catch {
    // Core gameplay deliberately ignores update/network failures.
  }
}

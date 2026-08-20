import React, { useEffect, useState } from 'react';

import { DetailScreen } from '@/components/DetailScreen';
import { applyDownloadedUpdate, checkAndDownloadUpdate, getUpdateSnapshot, type UpdateSnapshot } from '@/services/updateService';
import { useGame } from '@/state/GameProvider';
import { Body, Card, Heading, PrimaryButton, StatusPill } from '@/ui/components';

export default function UpdatesScreen() {
  const { world, updateSettings } = useGame();
  const [snapshot, setSnapshot] = useState<UpdateSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void getUpdateSnapshot().then(setSnapshot); }, []);
  if (!world) return null;
  const check = async () => {
    setBusy(true);
    try { setSnapshot(await checkAndDownloadUpdate()); }
    catch { setSnapshot((current) => ({ enabled: current?.enabled ?? true, channel: current?.channel ?? 'unknown', runtimeVersion: current?.runtimeVersion ?? 'unknown', available: false, downloaded: false, message: 'The update check could not reach Expo. The embedded game remains fully playable offline.' })); }
    finally { setBusy(false); }
  };
  return (
    <DetailScreen title="Game Updates" eyebrow="OTA · COMPATIBLE JAVASCRIPT & CONTENT">
      <Card accent><StatusPill tone={snapshot?.enabled ? 'success' : 'neutral'}>{snapshot?.enabled ? 'OTA enabled' : 'Embedded build'}</StatusPill><Heading size="small">Offline launch is always available</Heading><Body secondary>{snapshot?.message ?? 'Reading update status…'}</Body><Body secondary>Channel: {snapshot?.channel ?? '—'} · Runtime: {snapshot?.runtimeVersion ?? '—'}</Body></Card>
      <PrimaryButton title={busy ? 'Checking…' : 'Check and download update'} disabled={busy || snapshot?.enabled === false} onPress={() => { void check(); }} />
      {snapshot?.downloaded ? <PrimaryButton title="Apply downloaded update now" onPress={() => { void applyDownloadedUpdate(); }} /> : null}
      <PrimaryButton title={world.settings.autoDownloadUpdates ? 'Automatic downloads: On' : 'Automatic downloads: Off'} tone="neutral" onPress={() => { void updateSettings({ autoDownloadUpdates: !world.settings.autoDownloadUpdates }); }} />
      <Card><Heading size="small">When a new App Store build is still required</Heading><Body secondary>Native module changes, permissions, entitlements, icons, and a new native runtime still require TestFlight/App Store review. Game rules, local content, copy, and interface code can ship over the compatible OTA channel.</Body></Card>
    </DetailScreen>
  );
}

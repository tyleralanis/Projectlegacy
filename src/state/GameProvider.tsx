import * as Haptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { executeAction } from '@/engine/actions';
import { allocateId, createWorld } from '@/engine/createWorld';
import { runDeveloperCommand, type DeveloperCommand } from '@/engine/developerTools';
import { activityLevel, advanceWorld, resolveEvent } from '@/engine/simulation';
import type { AdvanceSummary, FavoriteEntityType, FocusArea, GameSettings, IntentAction, IntentAuditEntry, OutcomeExplanation, WorldState } from '@/engine/types';
import { toggleFavorite } from '@/engine/worldIndex';
import { createRepository } from '@/storage';
import type { GameRepository, RecoveryCheckpointSummary, SaveSlotSummary } from '@/storage/repository';

interface NewLifeOptions {
  firstName: string;
  lastName: string;
  seed: string;
  startAgeYears: number;
}

interface GameContextValue {
  world: WorldState | null;
  ready: boolean;
  busy: boolean;
  error: string | null;
  message: string | null;
  lastSummary: AdvanceSummary | null;
  lastExplanation: OutcomeExplanation | null;
  saves: SaveSlotSummary[];
  checkpoints: RecoveryCheckpointSummary[];
  advance(weeks: number): Promise<void>;
  resolveActiveEvent(eventId: string, choiceId: string): Promise<void>;
  performAction(action: IntentAction, confirmed?: boolean): Promise<{ completed: boolean; message: string; requiresConfirmation: boolean; explanation?: OutcomeExplanation }>;
  newLife(options: NewLifeOptions): Promise<void>;
  exportSave(): Promise<string>;
  importSave(): Promise<void>;
  deleteAllData(): Promise<void>;
  deleteSave(saveId: string): Promise<void>;
  switchSave(saveId: string): Promise<void>;
  rollbackSave(checkpointId: number): Promise<void>;
  renameCurrentSave(displayName: string): Promise<void>;
  refreshSaveLibrary(): Promise<void>;
  logIntent(entry: Omit<IntentAuditEntry, 'id' | 'week'>): Promise<void>;
  togglePin(entityType: FavoriteEntityType, entityId: string, label: string): Promise<boolean>;
  runDeveloper(command: DeveloperCommand): Promise<void>;
  updateSettings(settings: Partial<GameSettings>): Promise<void>;
  setFocus(focuses: FocusArea[]): Promise<void>;
  activityFor(weeks: number): 'LOW' | 'MODERATE' | 'HIGH';
  clearNotice(): void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: React.PropsWithChildren) {
  const repositoryRef = useRef<GameRepository | null>(null);
  const worldRef = useRef<WorldState | null>(null);
  const [world, setWorld] = useState<WorldState | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<AdvanceSummary | null>(null);
  const [lastExplanation, setLastExplanation] = useState<OutcomeExplanation | null>(null);
  const [saves, setSaves] = useState<SaveSlotSummary[]>([]);
  const [checkpoints, setCheckpoints] = useState<RecoveryCheckpointSummary[]>([]);

  const refreshSaveLibrary = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository) return;
    const nextSaves = await repository.listSaves();
    setSaves(nextSaves);
    const activeSaveId = world?.metadata.saveId ?? nextSaves[0]?.saveId;
    setCheckpoints(activeSaveId ? await repository.listCheckpoints(activeSaveId) : []);
  }, [world?.metadata.saveId]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const repository = await createRepository();
        repositoryRef.current = repository;
        await repository.initialize();
        const saved = await repository.loadLatest();
        const initial = saved ?? createWorld({ seed: 'legacy-harborview-001', startAgeYears: 0 });
        if (!saved) await repository.saveWorld(initial);
        if (mounted) {
          setWorld(initial);
          worldRef.current = initial;
          setSaves(await repository.listSaves());
          setCheckpoints(await repository.listCheckpoints(initial.metadata.saveId));
        }
      } catch (caught) {
        if (mounted) setError(caught instanceof Error ? caught.message : 'Unable to load the local world.');
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const persist = useCallback(async (next: WorldState) => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error('The local save repository is not ready.');
    await repository.saveWorld(next);
    worldRef.current = next;
    setWorld(next);
    setSaves(await repository.listSaves());
    setCheckpoints(await repository.listCheckpoints(next.metadata.saveId));
  }, []);

  const runBusy = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    setBusy(true);
    setError(null);
    try {
      return await operation();
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : 'The operation could not be completed.';
      setError(detail);
      throw caught;
    } finally {
      setBusy(false);
    }
  }, []);

  const advance = useCallback(async (weeks: number) => {
    if (!world) return;
    await runBusy(async () => {
      const result = advanceWorld(world, weeks, { interrupt: true, autoResolveEvents: true });
      await persist(result.world);
      setLastSummary(result.summary);
      setLastExplanation(result.summary.explanation ?? null);
      setMessage(result.summary.interruptedByEventId ? 'A major decision needs your attention.' : result.summary.highlights[0] ?? 'Time advanced.');
      if (world.settings.hapticsEnabled) {
        await Haptics.notificationAsync(result.summary.interruptedByEventId ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success);
      }
    });
  }, [persist, runBusy, world]);

  const resolveActiveEvent = useCallback(async (eventId: string, choiceId: string) => {
    if (!world) return;
    await runBusy(async () => {
      const event = world.events.find((item) => item.id === eventId && !item.resolved);
      if (!event) {
        setMessage('That decision is no longer active.');
        return;
      }

      let capacityBusinessId: string | undefined;
      if (event.templateId === 'business.capacity') {
        const business = Object.values(world.businesses).find((item) => event.participantIds.includes(item.organizationId) && item.active);
        if (business) {
          capacityBusinessId = business.id;
          if (choiceId === 'hire') {
            const hires = Math.max(1, Math.ceil(business.employees * 0.25));
            const hiringCost = hires * 175_000;
            if (business.cashCents < hiringCost) {
              setMessage(`${business.name} needs ${(hiringCost / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} in company cash to make that hiring move. Add capital, borrow, raise funds, or choose another response.`);
              return;
            }
          }
          if (choiceId === 'delegate' && business.cashCents < 250_000) {
            setMessage(`${business.name} needs $2,500 in company cash to put day-to-day operations under management.`);
            return;
          }
        }
      }

      const next = resolveEvent(world, eventId, choiceId);
      if (event.templateId === 'business.capacity' && capacityBusinessId) {
        const business = next.businesses[capacityBusinessId];
        if (business) {
          if (choiceId === 'delegate') business.cashCents -= 250_000;
          if (choiceId === 'raise-price') business.demand = Math.min(business.demand, business.capacity * 1.12);
          if (choiceId === 'reduce-marketing') business.demand = Math.min(business.demand, business.capacity * 1.1);
          if (choiceId === 'delegate') {
            business.capacity = Math.max(business.capacity, Math.round(business.capacity * 1.08));
            business.demand = Math.min(business.demand, business.capacity * 1.14);
          }
        }
      }

      await persist(next);
      setMessage('Your decision is now part of the world.');
      if (world.settings.hapticsEnabled) await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    });
  }, [persist, runBusy, world]);

  const performAction = useCallback(async (action: IntentAction, confirmed = false) => {
    if (!world) return { completed: false, message: 'The world is not ready.', requiresConfirmation: false };
    const result = executeAction(world, action, confirmed);
    if (result.validation.requiresConfirmation && !confirmed) return { completed: false, message: result.message, requiresConfirmation: true, explanation: result.explanation };
    if (!result.validation.valid) return { completed: false, message: result.message, requiresConfirmation: false, explanation: result.explanation };
    await runBusy(async () => {
      await persist(result.world);
      setMessage(result.message);
      setLastExplanation(result.explanation ?? null);
      if (world.settings.hapticsEnabled) await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });
    return { completed: true, message: result.message, requiresConfirmation: false, explanation: result.explanation };
  }, [persist, runBusy, world]);

  const newLife = useCallback(async (options: NewLifeOptions) => {
    await runBusy(async () => {
      const next = createWorld(options);
      await persist(next);
      setLastSummary(null);
      setLastExplanation(null);
      setMessage(options.startAgeYears === 0 ? 'A new life has begun.' : `A new life has begun at age ${options.startAgeYears}.`);
    });
  }, [persist, runBusy]);

  const exportSave = useCallback(async () => {
    if (!world || !repositoryRef.current) throw new Error('There is no save to export.');
    return runBusy(async () => {
      const path = await repositoryRef.current!.exportWorld(world);
      setMessage('The save package is ready to share or store in Files.');
      return path;
    });
  }, [runBusy, world]);

  const importSave = useCallback(async () => {
    if (!repositoryRef.current) throw new Error('The local save repository is not ready.');
    await runBusy(async () => {
      const imported = await repositoryRef.current!.importWorld();
      await repositoryRef.current!.saveWorld(imported);
      setWorld(imported);
      worldRef.current = imported;
      setSaves(await repositoryRef.current!.listSaves());
      setCheckpoints(await repositoryRef.current!.listCheckpoints(imported.metadata.saveId));
      setMessage('The imported world passed validation and is now active.');
    });
  }, [runBusy]);

  const deleteAllData = useCallback(async () => {
    if (!repositoryRef.current) return;
    await runBusy(async () => {
      await repositoryRef.current!.deleteAll();
      const fresh = createWorld({ seed: `legacy-${Date.now()}`, startAgeYears: 0 });
      await repositoryRef.current!.saveWorld(fresh);
      setWorld(fresh);
      worldRef.current = fresh;
      setLastSummary(null);
      setLastExplanation(null);
      setMessage('All prior local saves and diagnostics were deleted. A new life has begun at birth.');
    });
  }, [runBusy]);

  const deleteSave = useCallback(async (saveId: string) => {
    if (!repositoryRef.current || !world) return;
    if (saves.length <= 1) throw new Error('Create another save before deleting the only slot.');
    await runBusy(async () => {
      await repositoryRef.current!.deleteSave(saveId);
      const next = saveId === world.metadata.saveId ? await repositoryRef.current!.loadLatest() : world;
      if (!next) throw new Error('No save remains to open.');
      setWorld(next);
      worldRef.current = next;
      setSaves(await repositoryRef.current!.listSaves());
      setCheckpoints(await repositoryRef.current!.listCheckpoints(next.metadata.saveId));
      setMessage('The selected save slot was deleted.');
    });
  }, [runBusy, saves.length, world]);

  const switchSave = useCallback(async (saveId: string) => {
    if (!repositoryRef.current) return;
    await runBusy(async () => {
      const selected = await repositoryRef.current!.loadSave(saveId);
      if (!selected) throw new Error('That save slot no longer exists.');
      setWorld(selected);
      worldRef.current = selected;
      setCheckpoints(await repositoryRef.current!.listCheckpoints(saveId));
      setLastSummary(null);
      setLastExplanation(null);
      setMessage(`Opened ${selected.metadata.displayName}.`);
    });
  }, [runBusy]);

  const rollbackSave = useCallback(async (checkpointId: number) => {
    if (!repositoryRef.current || !world) return;
    await runBusy(async () => {
      const restored = await repositoryRef.current!.rollbackToCheckpoint(world.metadata.saveId, checkpointId);
      setWorld(restored);
      worldRef.current = restored;
      setSaves(await repositoryRef.current!.listSaves());
      setCheckpoints(await repositoryRef.current!.listCheckpoints(restored.metadata.saveId));
      setLastSummary(null);
      setLastExplanation(null);
      setMessage('The save was rolled back. The pre-rollback state remains as a recovery generation.');
    });
  }, [runBusy, world]);

  const renameCurrentSave = useCallback(async (displayName: string) => {
    const current = worldRef.current;
    if (!current) return;
    const next = JSON.parse(JSON.stringify(current)) as WorldState;
    next.metadata.displayName = displayName.trim().slice(0, 60) || next.metadata.displayName;
    await persist(next);
    setMessage('Save slot renamed.');
  }, [persist]);

  const logIntent = useCallback(async (entry: Omit<IntentAuditEntry, 'id' | 'week'>) => {
    const current = worldRef.current;
    if (!current) return;
    const next = JSON.parse(JSON.stringify(current)) as WorldState;
    next.intentHistory.unshift({ ...entry, id: allocateId(next, 'intent-log'), week: next.calendar.week });
    if (next.intentHistory.length > next.performance.intentLogLimit) next.intentHistory.length = next.performance.intentLogLimit;
    await persist(next);
  }, [persist]);

  const togglePin = useCallback(async (entityType: FavoriteEntityType, entityId: string, label: string) => {
    if (!world) return false;
    const next = JSON.parse(JSON.stringify(world)) as WorldState;
    const pinned = toggleFavorite(next, entityType, entityId, label);
    await persist(next);
    setMessage(pinned ? 'Pinned to favorites.' : 'Removed from favorites.');
    return pinned;
  }, [persist, world]);

  const runDeveloper = useCallback(async (command: DeveloperCommand) => {
    if (!world?.settings.developerUnlocked) throw new Error('The developer menu is locked.');
    const result = runDeveloperCommand(world, command);
    await persist(result.world);
    setMessage(result.message);
  }, [persist, world]);

  const updateSettings = useCallback(async (settings: Partial<GameSettings>) => {
    if (!world) return;
    const next = JSON.parse(JSON.stringify(world)) as WorldState;
    next.settings = { ...next.settings, ...settings };
    await persist(next);
  }, [persist, world]);

  const setFocus = useCallback(async (focuses: FocusArea[]) => {
    if (!world) return;
    const next = JSON.parse(JSON.stringify(world)) as WorldState;
    next.characters[next.playerCharacterId].focuses = [...new Set(focuses)].slice(0, 3);
    await persist(next);
    setMessage('Standing focuses updated. Fast-forward autonomy will use them.');
  }, [persist, world]);

  const value = useMemo<GameContextValue>(() => ({
    world,
    ready,
    busy,
    error,
    message,
    lastSummary,
    lastExplanation,
    saves,
    checkpoints,
    advance,
    resolveActiveEvent,
    performAction,
    newLife,
    exportSave,
    importSave,
    deleteAllData,
    deleteSave,
    switchSave,
    rollbackSave,
    renameCurrentSave,
    refreshSaveLibrary,
    logIntent,
    togglePin,
    runDeveloper,
    updateSettings,
    setFocus,
    activityFor: (weeks) => (world ? activityLevel(world, weeks) : 'LOW'),
    clearNotice: () => { setMessage(null); setError(null); },
  }), [advance, busy, checkpoints, deleteAllData, deleteSave, error, exportSave, importSave, lastExplanation, lastSummary, logIntent, message, newLife, performAction, ready, refreshSaveLibrary, renameCurrentSave, resolveActiveEvent, rollbackSave, runDeveloper, saves, setFocus, switchSave, togglePin, updateSettings, world]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used inside GameProvider.');
  return context;
}

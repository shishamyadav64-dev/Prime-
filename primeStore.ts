import fs from 'fs';
import path from 'path';
import {
  DEFAULT_GAME_SPACE_STATE,
  DEFAULT_YOUTUBE_AGENTS,
  DEFAULT_YOUTUBE_AGENT_SETTINGS,
  PRIMARY_ADMIN_EMAIL,
  type BatchVideoItem,
  type GameSpaceState,
  type MemoryItem,
  type NexusPlatformExport,
  type PassiveObservation,
  type PassiveSignalSource,
  type PrimeMessage,
  type PrimeSettings,
  type PrimeVaultSnapshot,
  type SubTask,
  type TaskItem,
  type TokenStats,
  type VoiceProfile,
  type WorkforcePlan,
  type WorkforceTask,
  type YouTubeAgentConfig,
  type YouTubeAgentPostJob,
  type YouTubeAgentSettings,
} from '../src/types/prime.ts';
export {DEFAULT_GAME_SPACE_STATE};
import {buildTimeGreeting} from './primePersonality.ts';

const STORE_PATH = path.resolve(process.cwd(), '.prime-data.json');

const DEFAULT_SETTINGS: PrimeSettings = {
  preferredTitle: 'Sir',
  mannerProfile: 'refined_gentleman',
  autoSpeakGreeting: false,
  autoSpeakReplies: false,
  voiceEngine: 'neural_tts',
  geminiVoicePersona: 'Charon',
  vocalStyle: 'refined_butler',
  devicePitch: 0.96,
  deviceSpeechRate: 1.0,
  deviceVoiceName: '',
  activeCustomVoiceId: null,
  activeCustomVoiceName: null,
  brainDepth: 'fast',
  webSearchEnabled: true,
  showReasoningTrace: true,
  autoLearnEnabled: true,
  passiveLearnEnabled: true,
  smartContextEnabled: false,
  wakeWordEnabled: false,
  wakeResponsePhrase: 'What happened, boss?',
  backgroundListenMode: false,
  millionContextEnabled: true,
  expressiveVoiceMode: true,
  voiceDesignPrompt: '',
};

const DEFAULT_TOKEN_STATS: TokenStats = {
  sessionTokens: 0,
  lifetimeTokens: 0,
  contextLimitTokens: 1_000_000,
  lastRequestTokens: 0,
  budgetTokens: 250_000,
};



function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createInitialSnapshot(): PrimeVaultSnapshot {
  const greeting = buildTimeGreeting(DEFAULT_SETTINGS, 0);
  return {
    settings: {...DEFAULT_SETTINGS},
    messages: [
      {
        id: makeId('msg'),
        isUser: false,
        text: greeting,
        reasoningTrace:
          'Session initialized with Refined Gentleman etiquette and checked active agenda.',
        timestampMs: Date.now(),
      },
    ],
    memories: [],
    tasks: [],
    voiceProfiles: [
      {
        id: 'voice_default_butler',
        name: 'Classic Butler',
        engineMode: 'neural_tts',
        geminiPersona: 'Charon',
        vocalStyle: 'refined_butler',
        deviceVoiceName: '',
        pitch: 0.96,
        speechRate: 1.0,
        samplePhrase:
          'Good evening, Sir. Classic Butler voice is calibrated and at your service.',
        createdAtMs: Date.now(),
      },
    ],
    passiveObservations: [],
    adminEmails: [PRIMARY_ADMIN_EMAIL],
    tokenStats: {...DEFAULT_TOKEN_STATS},
    workforcePlan: null,
    batchVideos: [],
    gameSpace: structuredClone(DEFAULT_GAME_SPACE_STATE),
    youtubeAgents: structuredClone(DEFAULT_YOUTUBE_AGENTS),
    youtubePostQueue: [],
    youtubeAgentSettings: {...DEFAULT_YOUTUBE_AGENT_SETTINGS},
  };
}

function normalizeAdminList(raw: unknown): string[] {
  const set = new Set<string>([PRIMARY_ADMIN_EMAIL.toLowerCase()]);
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const email = String(item ?? '').trim().toLowerCase();
      if (email.includes('@')) set.add(email);
    }
  }
  return Array.from(set);
}

function normalizeGameSpace(raw?: Partial<GameSpaceState> | null): GameSpaceState {
  if (!raw) return structuredClone(DEFAULT_GAME_SPACE_STATE);
  return {
    ...DEFAULT_GAME_SPACE_STATE,
    ...raw,
    leftTrigger: {...DEFAULT_GAME_SPACE_STATE.leftTrigger, ...(raw.leftTrigger ?? {})},
    rightTrigger: {...DEFAULT_GAME_SPACE_STATE.rightTrigger, ...(raw.rightTrigger ?? {})},
    macros: Array.isArray(raw.macros) ? raw.macros : DEFAULT_GAME_SPACE_STATE.macros,
    games: Array.isArray(raw.games) && raw.games.length > 0 ? raw.games : DEFAULT_GAME_SPACE_STATE.games,
  };
}

function writeSnapshot(snapshot: PrimeVaultSnapshot): void {
  const normalized: PrimeVaultSnapshot = {
    ...snapshot,
    passiveObservations: Array.isArray(snapshot.passiveObservations)
      ? snapshot.passiveObservations
      : [],
    adminEmails: normalizeAdminList(snapshot.adminEmails),
    tokenStats: {...DEFAULT_TOKEN_STATS, ...(snapshot.tokenStats ?? {})},
    workforcePlan: snapshot.workforcePlan ?? null,
    batchVideos: Array.isArray(snapshot.batchVideos) ? snapshot.batchVideos : [],
    nexusImport: snapshot.nexusImport ?? null,
    gameSpace: normalizeGameSpace(snapshot.gameSpace),
    youtubeAgents:
      Array.isArray(snapshot.youtubeAgents) && snapshot.youtubeAgents.length > 0
        ? snapshot.youtubeAgents
        : structuredClone(DEFAULT_YOUTUBE_AGENTS),
    youtubePostQueue: Array.isArray(snapshot.youtubePostQueue) ? snapshot.youtubePostQueue : [],
    youtubeAgentSettings: {
      ...DEFAULT_YOUTUBE_AGENT_SETTINGS,
      ...(snapshot.youtubeAgentSettings ?? {}),
    },
  };
  fs.writeFileSync(STORE_PATH, JSON.stringify(normalized, null, 2), 'utf8');
}

export function readSnapshot(): PrimeVaultSnapshot {
  if (!fs.existsSync(STORE_PATH)) {
    const initial = createInitialSnapshot();
    writeSnapshot(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PrimeVaultSnapshot>;
    return {
      settings: {...DEFAULT_SETTINGS, ...(parsed.settings ?? {})},
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      memories: Array.isArray(parsed.memories) ? parsed.memories : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      voiceProfiles: Array.isArray(parsed.voiceProfiles) ? parsed.voiceProfiles : [],
      passiveObservations: Array.isArray(parsed.passiveObservations)
        ? parsed.passiveObservations
        : [],
      adminEmails: normalizeAdminList(parsed.adminEmails),
      tokenStats: {...DEFAULT_TOKEN_STATS, ...(parsed.tokenStats ?? {})},
      workforcePlan: parsed.workforcePlan ?? null,
      batchVideos: Array.isArray(parsed.batchVideos) ? parsed.batchVideos : [],
      nexusImport: parsed.nexusImport ?? null,
      gameSpace: normalizeGameSpace(parsed.gameSpace),
      youtubeAgents:
        Array.isArray(parsed.youtubeAgents) && parsed.youtubeAgents.length > 0
          ? parsed.youtubeAgents
          : structuredClone(DEFAULT_YOUTUBE_AGENTS),
      youtubePostQueue: Array.isArray(parsed.youtubePostQueue) ? parsed.youtubePostQueue : [],
      youtubeAgentSettings: {
        ...DEFAULT_YOUTUBE_AGENT_SETTINGS,
        ...(parsed.youtubeAgentSettings ?? {}),
      },
    };
  } catch {
    const initial = createInitialSnapshot();
    writeSnapshot(initial);
    return initial;
  }
}

export function updateSettings(patch: Partial<PrimeSettings>): PrimeVaultSnapshot {
  const snap = readSnapshot();
  snap.settings = {...snap.settings, ...patch};
  writeSnapshot(snap);
  return snap;
}

export function appendMessages(...items: PrimeMessage[]): PrimeVaultSnapshot {
  const snap = readSnapshot();
  snap.messages.push(...items);
  writeSnapshot(snap);
  return snap;
}

export function resetMessages(): PrimeVaultSnapshot {
  const snap = readSnapshot();
  const pendingCount = snap.tasks.filter((t) => !t.isCompleted).length;
  const greeting = buildTimeGreeting(snap.settings, pendingCount);
  snap.messages = [
    {
      id: makeId('msg'),
      isUser: false,
      text: greeting,
      reasoningTrace: `Fresh exchange started with ${snap.settings.mannerProfile.replace('_', ' ')} etiquette.`,
      timestampMs: Date.now(),
    },
  ];
  writeSnapshot(snap);
  return snap;
}

export function addMemory(
  category: MemoryItem['category'],
  fact: string,
): {snapshot: PrimeVaultSnapshot; item: MemoryItem} {
  const snap = readSnapshot();
  const item: MemoryItem = {
    id: makeId('mem'),
    category,
    fact: fact.trim(),
    createdAtMs: Date.now(),
  };
  snap.memories.unshift(item);
  writeSnapshot(snap);
  return {snapshot: snap, item};
}

export function addMemoryIfUnique(
  category: MemoryItem['category'],
  fact: string,
): {snapshot: PrimeVaultSnapshot; item: MemoryItem | null} {
  const cleaned = fact.trim();
  const snap = readSnapshot();
  if (!cleaned || cleaned.length < 6) {
    return {snapshot: snap, item: null};
  }
  const norm = cleaned.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const duplicate = snap.memories.some((existing) => {
    const exNorm = existing.fact.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    return exNorm === norm || (norm.length > 18 && (exNorm.includes(norm) || norm.includes(exNorm)));
  });
  if (duplicate) {
    return {snapshot: snap, item: null};
  }
  const item: MemoryItem = {
    id: makeId('mem'),
    category,
    fact: cleaned,
    createdAtMs: Date.now(),
  };
  snap.memories.unshift(item);
  writeSnapshot(snap);
  return {snapshot: snap, item};
}

export function removeMemory(id: string): PrimeVaultSnapshot {
  const snap = readSnapshot();
  snap.memories = snap.memories.filter((m) => m.id !== id);
  writeSnapshot(snap);
  return snap;
}

export function clearMemories(): PrimeVaultSnapshot {
  const snap = readSnapshot();
  snap.memories = [];
  writeSnapshot(snap);
  return snap;
}

function normalizeTaskTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of raw) {
    const cleaned = String(entry ?? '')
      .trim()
      .replace(/^#+/, '')
      .replace(/\s+/g, ' ')
      .slice(0, 28);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= 12) break;
  }
  return result;
}

export function addTask(
  title: string,
  priority: TaskItem['priority'] = 'Normal',
  dueNote = '',
  dueAtMs: number | null = null,
  autoStartOnDue = false,
  tags: string[] = [],
): {snapshot: PrimeVaultSnapshot; item: TaskItem} {
  const snap = readSnapshot();
  const item: TaskItem = {
    id: makeId('task'),
    title: title.trim(),
    priority,
    dueNote: dueNote.trim(),
    dueAtMs: typeof dueAtMs === 'number' && Number.isFinite(dueAtMs) ? dueAtMs : null,
    autoStartOnDue: Boolean(autoStartOnDue),
    autoStartedAtMs: null,
    notes: '',
    subTasks: [],
    tags: normalizeTaskTags(tags),
    isCompleted: false,
    createdAtMs: Date.now(),
  };
  snap.tasks.unshift(item);
  writeSnapshot(snap);
  return {snapshot: snap, item};
}

export function completeTaskByQuery(query: string): {
  snapshot: PrimeVaultSnapshot;
  completed?: TaskItem;
} {
  const snap = readSnapshot();
  const q = query.trim().toLowerCase();
  const target =
    snap.tasks.find((t) => !t.isCompleted && t.title.toLowerCase().includes(q)) ??
    snap.tasks.find((t) => !t.isCompleted && q.includes(t.title.toLowerCase()));
  if (!target) {
    return {snapshot: snap};
  }
  target.isCompleted = true;
  writeSnapshot(snap);
  return {snapshot: snap, completed: target};
}

export function toggleTask(id: string): PrimeVaultSnapshot {
  const snap = readSnapshot();
  snap.tasks = snap.tasks.map((t) => {
    if (t.id !== id) return t;
    const nextCompleted = !t.isCompleted;
    return {
      ...t,
      isCompleted: nextCompleted,
      status: nextCompleted ? 'completed' : 'pending',
      lastError: nextCompleted ? undefined : t.lastError,
    };
  });
  writeSnapshot(snap);
  return snap;
}

export function updateTaskDetails(
  id: string,
  patch: {
    notes?: string;
    subTasks?: SubTask[];
    tags?: string[];
    dueNote?: string;
    dueAtMs?: number | null;
    autoStartOnDue?: boolean;
    autoStartedAtMs?: number | null;
    status?: TaskItem['status'];
    lastError?: string;
    retryCount?: number;
  },
): PrimeVaultSnapshot {
  const snap = readSnapshot();
  snap.tasks = snap.tasks.map((t) => {
    if (t.id !== id) return t;
    return {
      ...t,
      ...(typeof patch.notes === 'string' ? {notes: patch.notes} : {}),
      ...(Array.isArray(patch.subTasks) ? {subTasks: patch.subTasks} : {}),
      ...(Array.isArray(patch.tags) ? {tags: normalizeTaskTags(patch.tags)} : {}),
      ...(typeof patch.dueNote === 'string' ? {dueNote: patch.dueNote.trim()} : {}),
      ...(patch.dueAtMs !== undefined ? {dueAtMs: patch.dueAtMs} : {}),
      ...(typeof patch.autoStartOnDue === 'boolean'
        ? {autoStartOnDue: patch.autoStartOnDue}
        : {}),
      ...(patch.autoStartedAtMs !== undefined ? {autoStartedAtMs: patch.autoStartedAtMs} : {}),
      ...(patch.status !== undefined ? {status: patch.status} : {}),
      ...(patch.lastError !== undefined ? {lastError: patch.lastError} : {}),
      ...(typeof patch.retryCount === 'number' ? {retryCount: patch.retryCount} : {}),
    };
  });
  writeSnapshot(snap);
  return snap;
}

export function retryTask(id: string, rescheduleMinutes = 15): PrimeVaultSnapshot {
  const snap = readSnapshot();
  const nextDue = Date.now() + Math.max(1, rescheduleMinutes) * 60_000;
  snap.tasks = snap.tasks.map((t) => {
    if (t.id !== id) return t;
    return {
      ...t,
      isCompleted: false,
      status: 'pending',
      lastError: undefined,
      retryCount: (t.retryCount ?? 0) + 1,
      autoStartedAtMs: null,
      dueAtMs: t.dueAtMs && t.dueAtMs <= Date.now() ? nextDue : t.dueAtMs,
    };
  });
  writeSnapshot(snap);
  return snap;
}

export function retryAllFailedOrOverdueTasks(rescheduleMinutes = 15): {
  snapshot: PrimeVaultSnapshot;
  retriedIds: string[];
} {
  const snap = readSnapshot();
  const now = Date.now();
  const nextDue = now + Math.max(1, rescheduleMinutes) * 60_000;
  const retriedIds: string[] = [];
  snap.tasks = snap.tasks.map((t) => {
    if (t.isCompleted) return t;
    const isFailed = t.status === 'failed' || Boolean(t.lastError);
    const isExpired = typeof t.dueAtMs === 'number' && t.dueAtMs <= now;
    if (!isFailed && !isExpired) return t;
    retriedIds.push(t.id);
    return {
      ...t,
      isCompleted: false,
      status: 'pending',
      lastError: undefined,
      retryCount: (t.retryCount ?? 0) + 1,
      autoStartedAtMs: null,
      dueAtMs: isExpired ? nextDue : t.dueAtMs,
    };
  });
  writeSnapshot(snap);
  return {snapshot: snap, retriedIds};
}

export function removeTask(id: string): PrimeVaultSnapshot {
  const snap = readSnapshot();
  snap.tasks = snap.tasks.filter((t) => t.id !== id);
  writeSnapshot(snap);
  return snap;
}

export function bulkToggleTasks(ids: string[]): PrimeVaultSnapshot {
  const idSet = new Set(ids);
  const snap = readSnapshot();
  snap.tasks = snap.tasks.map((t) => (idSet.has(t.id) ? {...t, isCompleted: !t.isCompleted} : t));
  writeSnapshot(snap);
  return snap;
}

export function bulkRemoveTasks(ids: string[]): PrimeVaultSnapshot {
  const idSet = new Set(ids);
  const snap = readSnapshot();
  snap.tasks = snap.tasks.filter((t) => !idSet.has(t.id));
  writeSnapshot(snap);
  return snap;
}

export function reorderTasks(orderedIds: string[]): PrimeVaultSnapshot {
  const snap = readSnapshot();
  const byId = new Map(snap.tasks.map((t) => [t.id, t]));
  const reordered: TaskItem[] = [];
  const seen = new Set<string>();

  for (const id of orderedIds) {
    const task = byId.get(id);
    if (task && !seen.has(id)) {
      reordered.push(task);
      seen.add(id);
    }
  }
  for (const task of snap.tasks) {
    if (!seen.has(task.id)) {
      reordered.push(task);
    }
  }

  snap.tasks = reordered;
  writeSnapshot(snap);
  return snap;
}

export function createVoiceProfile(
  input: Omit<VoiceProfile, 'id' | 'createdAtMs'>,
  activate = true,
): {snapshot: PrimeVaultSnapshot; profile: VoiceProfile} {
  const snap = readSnapshot();
  const profile: VoiceProfile = {
    ...input,
    id: makeId('voice'),
    createdAtMs: Date.now(),
  };
  snap.voiceProfiles.unshift(profile);
  if (activate) {
    snap.settings = {
      ...snap.settings,
      voiceEngine: profile.engineMode,
      geminiVoicePersona: profile.geminiPersona,
      vocalStyle: profile.vocalStyle,
      deviceVoiceName: profile.deviceVoiceName,
      devicePitch: profile.pitch,
      deviceSpeechRate: profile.speechRate,
      activeCustomVoiceId: profile.id,
      activeCustomVoiceName: profile.name,
    };
  }
  writeSnapshot(snap);
  return {snapshot: snap, profile};
}

export function updateVoiceProfile(
  id: string,
  input: Omit<VoiceProfile, 'id' | 'createdAtMs'>,
  activate = true,
): PrimeVaultSnapshot {
  const snap = readSnapshot();
  let updated: VoiceProfile | undefined;
  snap.voiceProfiles = snap.voiceProfiles.map((v) => {
    if (v.id !== id) return v;
    updated = {...v, ...input};
    return updated;
  });
  if (updated && (activate || snap.settings.activeCustomVoiceId === id)) {
    snap.settings = {
      ...snap.settings,
      voiceEngine: updated.engineMode,
      geminiVoicePersona: updated.geminiPersona,
      vocalStyle: updated.vocalStyle,
      deviceVoiceName: updated.deviceVoiceName,
      devicePitch: updated.pitch,
      deviceSpeechRate: updated.speechRate,
      activeCustomVoiceId: updated.id,
      activeCustomVoiceName: updated.name,
    };
  }
  writeSnapshot(snap);
  return snap;
}

export function activateVoiceProfile(id: string): {
  snapshot: PrimeVaultSnapshot;
  profile?: VoiceProfile;
} {
  const snap = readSnapshot();
  const profile = snap.voiceProfiles.find((v) => v.id === id);
  if (profile) {
    snap.settings = {
      ...snap.settings,
      voiceEngine: profile.engineMode,
      geminiVoicePersona: profile.geminiPersona,
      vocalStyle: profile.vocalStyle,
      deviceVoiceName: profile.deviceVoiceName,
      devicePitch: profile.pitch,
      deviceSpeechRate: profile.speechRate,
      activeCustomVoiceId: profile.id,
      activeCustomVoiceName: profile.name,
    };
    writeSnapshot(snap);
  }
  return {snapshot: snap, profile};
}

export function removeVoiceProfile(id: string): PrimeVaultSnapshot {
  const snap = readSnapshot();
  snap.voiceProfiles = snap.voiceProfiles.filter((v) => v.id !== id);
  if (snap.settings.activeCustomVoiceId === id) {
    snap.settings = {
      ...snap.settings,
      activeCustomVoiceId: null,
      activeCustomVoiceName: null,
    };
  }
  writeSnapshot(snap);
  return snap;
}

export function addAdminEmail(email: string): PrimeVaultSnapshot {
  const clean = email.trim().toLowerCase();
  const snap = readSnapshot();
  snap.adminEmails = normalizeAdminList([...(snap.adminEmails ?? []), clean]);
  writeSnapshot(snap);
  return snap;
}

export function removeAdminEmail(email: string): PrimeVaultSnapshot {
  const clean = email.trim().toLowerCase();
  const snap = readSnapshot();
  if (clean === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
    return snap;
  }
  snap.adminEmails = normalizeAdminList(
    (snap.adminEmails ?? []).filter((e) => e.toLowerCase() !== clean),
  );
  writeSnapshot(snap);
  return snap;
}

export function clearCompletedTasks(): PrimeVaultSnapshot {
  const snap = readSnapshot();
  snap.tasks = snap.tasks.filter((t) => !t.isCompleted);
  writeSnapshot(snap);
  return snap;
}

export function restoreSnapshot(payload: Partial<PrimeVaultSnapshot>): PrimeVaultSnapshot {
  const current = readSnapshot();
  const next: PrimeVaultSnapshot = {
    settings: {...DEFAULT_SETTINGS, ...(payload.settings ?? current.settings)},
    messages: Array.isArray(payload.messages) ? payload.messages : current.messages,
    memories: Array.isArray(payload.memories) ? payload.memories : current.memories,
    tasks: Array.isArray(payload.tasks) ? payload.tasks : current.tasks,
    voiceProfiles: Array.isArray(payload.voiceProfiles)
      ? payload.voiceProfiles
      : current.voiceProfiles,
    passiveObservations: Array.isArray(payload.passiveObservations)
      ? payload.passiveObservations
      : current.passiveObservations,
    adminEmails: normalizeAdminList(payload.adminEmails ?? current.adminEmails),
  };
  writeSnapshot(next);
  return next;
}

export function getStoreSizeBytes(): number {
  if (!fs.existsSync(STORE_PATH)) return 0;
  return fs.statSync(STORE_PATH).size;
}

export function recordPassiveObservation(
  signalSource: PassiveSignalSource,
  category: MemoryItem['category'],
  pattern: string,
): {snapshot: PrimeVaultSnapshot; observation: PassiveObservation | null} {
  const cleaned = pattern.trim();
  const snap = readSnapshot();
  if (!cleaned || cleaned.length < 8) {
    return {snapshot: snap, observation: null};
  }
  const norm = cleaned.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const existingIdx = snap.passiveObservations.findIndex((obs) => {
    const exNorm = obs.pattern.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    return (
      exNorm === norm || (norm.length > 18 && (exNorm.includes(norm) || norm.includes(exNorm)))
    );
  });

  let updatedObs: PassiveObservation;
  if (existingIdx >= 0) {
    const prev = snap.passiveObservations[existingIdx];
    const nextCount = prev.observationsCount + 1;
    updatedObs = {
      ...prev,
      signalSource,
      observationsCount: nextCount,
      confidence: nextCount >= 2 ? 'Confirmed' : prev.confidence,
      lastObservedAtMs: Date.now(),
    };
    snap.passiveObservations[existingIdx] = updatedObs;
  } else {
    updatedObs = {
      id: makeId('pass'),
      signalSource,
      category,
      pattern: cleaned,
      observationsCount: 1,
      confidence: 'Emerging',
      lastObservedAtMs: Date.now(),
    };
    snap.passiveObservations.unshift(updatedObs);
    if (snap.passiveObservations.length > 40) {
      snap.passiveObservations = snap.passiveObservations.slice(0, 40);
    }
  }
  writeSnapshot(snap);
  return {snapshot: snap, observation: updatedObs};
}

export function promotePassiveObservation(id: string): PrimeVaultSnapshot {
  const snap = readSnapshot();
  const target = snap.passiveObservations.find((o) => o.id === id);
  if (!target) return snap;
  target.confidence = 'Confirmed';
  writeSnapshot(snap);
  const {snapshot} = addMemoryIfUnique(target.category, target.pattern);
  return snapshot;
}

export function removePassiveObservation(id: string): PrimeVaultSnapshot {
  const snap = readSnapshot();
  snap.passiveObservations = snap.passiveObservations.filter((o) => o.id !== id);
  writeSnapshot(snap);
  return snap;
}

export function recordTokenUsage(tokens: number): PrimeVaultSnapshot {
  const safeTokens = Math.max(0, Math.round(Number(tokens) || 0));
  const snap = readSnapshot();
  const prev = {...DEFAULT_TOKEN_STATS, ...(snap.tokenStats ?? {})};
  snap.tokenStats = {
    ...prev,
    sessionTokens: prev.sessionTokens + safeTokens,
    lifetimeTokens: prev.lifetimeTokens + safeTokens,
    lastRequestTokens: safeTokens,
  };
  writeSnapshot(snap);
  return snap;
}

export function resetSessionTokenUsage(): PrimeVaultSnapshot {
  const snap = readSnapshot();
  const prev = {...DEFAULT_TOKEN_STATS, ...(snap.tokenStats ?? {})};
  snap.tokenStats = {
    ...prev,
    sessionTokens: 0,
    lastRequestTokens: 0,
  };
  writeSnapshot(snap);
  return snap;
}

export function setWorkforcePlan(plan: WorkforcePlan | null): PrimeVaultSnapshot {
  const snap = readSnapshot();
  snap.workforcePlan = plan;
  writeSnapshot(snap);
  return snap;
}

export function updateWorkforceTask(
  taskId: string,
  patch: Partial<WorkforceTask>,
  additionalTokens = 0,
): PrimeVaultSnapshot {
  const snap = readSnapshot();
  if (!snap.workforcePlan) return snap;
  snap.workforcePlan = {
    ...snap.workforcePlan,
    spentTokens: snap.workforcePlan.spentTokens + Math.max(0, Math.round(additionalTokens)),
    tasks: snap.workforcePlan.tasks.map((t) =>
      t.id === taskId ? {...t, ...patch, updatedAtMs: Date.now()} : t,
    ),
  };
  writeSnapshot(snap);
  return snap;
}

export function updateWorkforceSettings(patch: {
  budgetTokens?: number;
  requireApproval?: boolean;
  autoRetryFailed?: boolean;
}): PrimeVaultSnapshot {
  const snap = readSnapshot();
  if (!snap.workforcePlan) return snap;
  snap.workforcePlan = {
    ...snap.workforcePlan,
    ...(typeof patch.budgetTokens === 'number' && Number.isFinite(patch.budgetTokens)
      ? {budgetTokens: Math.max(5_000, Math.round(patch.budgetTokens))}
      : {}),
    ...(typeof patch.requireApproval === 'boolean'
      ? {requireApproval: patch.requireApproval}
      : {}),
    ...(typeof patch.autoRetryFailed === 'boolean'
      ? {autoRetryFailed: patch.autoRetryFailed}
      : {}),
  };
  writeSnapshot(snap);
  return snap;
}

export function setBatchVideos(items: BatchVideoItem[]): PrimeVaultSnapshot {
  const snap = readSnapshot();
  snap.batchVideos = items;
  writeSnapshot(snap);
  return snap;
}

export function updateBatchVideo(
  id: string,
  patch: Partial<BatchVideoItem>,
): PrimeVaultSnapshot {
  const snap = readSnapshot();
  snap.batchVideos = (snap.batchVideos ?? []).map((item) =>
    item.id === id ? {...item, ...patch} : item,
  );
  writeSnapshot(snap);
  return snap;
}

export function setNexusImport(nexusImport: NexusPlatformExport | null): PrimeVaultSnapshot {
  const snap = readSnapshot();
  snap.nexusImport = nexusImport;
  writeSnapshot(snap);
  return snap;
}

export function updateGameSpace(patch: Partial<GameSpaceState>): PrimeVaultSnapshot {
  const snap = readSnapshot();
  const current = normalizeGameSpace(snap.gameSpace);
  snap.gameSpace = normalizeGameSpace({
    ...current,
    ...patch,
    leftTrigger: patch.leftTrigger
      ? {...current.leftTrigger, ...patch.leftTrigger}
      : current.leftTrigger,
    rightTrigger: patch.rightTrigger
      ? {...current.rightTrigger, ...patch.rightTrigger}
      : current.rightTrigger,
  });
  writeSnapshot(snap);
  return snap;
}

export function updateYouTubeAgent(
  id: string,
  patch: Partial<YouTubeAgentConfig>,
): PrimeVaultSnapshot {
  const snap = readSnapshot();
  snap.youtubeAgents = (snap.youtubeAgents ?? structuredClone(DEFAULT_YOUTUBE_AGENTS)).map(
    (ag) => (ag.id === id ? {...ag, ...patch} : ag),
  );
  writeSnapshot(snap);
  return snap;
}

export function updateYouTubeAgentSettings(
  patch: Partial<YouTubeAgentSettings>,
): PrimeVaultSnapshot {
  const snap = readSnapshot();
  snap.youtubeAgentSettings = {
    ...DEFAULT_YOUTUBE_AGENT_SETTINGS,
    ...(snap.youtubeAgentSettings ?? {}),
    ...patch,
  };
  writeSnapshot(snap);
  return snap;
}

export function addYouTubePostJobs(
  jobs: YouTubeAgentPostJob[],
  replace = false,
): PrimeVaultSnapshot {
  const snap = readSnapshot();
  const existing = replace ? [] : snap.youtubePostQueue ?? [];
  snap.youtubePostQueue = [...jobs, ...existing].slice(0, 40);
  writeSnapshot(snap);
  return snap;
}

export function updateYouTubePostJob(
  id: string,
  patch: Partial<YouTubeAgentPostJob>,
): PrimeVaultSnapshot {
  const snap = readSnapshot();
  snap.youtubePostQueue = (snap.youtubePostQueue ?? []).map((job) =>
    job.id === id ? {...job, ...patch, updatedAtMs: Date.now()} : job,
  );
  writeSnapshot(snap);
  return snap;
}

export function deleteYouTubePostJob(id: string): PrimeVaultSnapshot {
  const snap = readSnapshot();
  snap.youtubePostQueue = (snap.youtubePostQueue ?? []).filter((job) => job.id !== id);
  writeSnapshot(snap);
  return snap;
}


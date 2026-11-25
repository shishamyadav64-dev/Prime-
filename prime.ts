export type MannerProfileId =
  | 'refined_gentleman'
  | 'warm_companion'
  | 'executive_strategist';

export type VoiceEngineMode = 'device_tts' | 'neural_tts';

export type GeminiVoicePersona = 'Charon' | 'Fenrir' | 'Kore' | 'Zephyr' | 'Puck';

export type VocalStyleId =
  | 'natural'
  | 'refined_butler'
  | 'warm_empathetic'
  | 'crisp_executive'
  | 'calm_narrator'
  | 'lively_wit';

export type BrainDepth = 'fast' | 'deep';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export type PrimeView =
  | 'companion'
  | 'workforce'
  | 'skills'
  | 'vault'
  | 'studio'
  | 'youtube'
  | 'gamespace'
  | 'admin';

export const PRIMARY_ADMIN_EMAIL = 'shishamyadav64@gmail.com';

export interface AuthUserProfile {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  provider: 'google' | 'local';
}

export interface MannerProfileOption {
  id: MannerProfileId;
  title: string;
  subtitle: string;
  sampleQuote: string;
  directive: string;
}

export interface GeminiPersonaOption {
  id: GeminiVoicePersona;
  label: string;
  tone: string;
}

export interface VocalStyleOption {
  id: VocalStyleId;
  label: string;
  direction: string;
}

export interface PrimeSettings {
  preferredTitle: string;
  mannerProfile: MannerProfileId;
  autoSpeakGreeting: boolean;
  autoSpeakReplies: boolean;
  voiceEngine: VoiceEngineMode;
  geminiVoicePersona: GeminiVoicePersona;
  vocalStyle: VocalStyleId;
  devicePitch: number;
  deviceSpeechRate: number;
  deviceVoiceName: string;
  activeCustomVoiceId: string | null;
  activeCustomVoiceName: string | null;
  brainDepth: BrainDepth;
  webSearchEnabled: boolean;
  showReasoningTrace: boolean;
  autoLearnEnabled: boolean;
  passiveLearnEnabled: boolean;
  smartContextEnabled: boolean;
  wakeWordEnabled: boolean;
  wakeResponsePhrase?: string;
  backgroundListenMode?: boolean;
  millionContextEnabled?: boolean;
  expressiveVoiceMode?: boolean;
  voiceDesignPrompt?: string;
}

export interface HowToStep {
  stepNumber: number;
  actionTitle: string;
  instruction: string;
  tip?: string;
  visualBadge: string;
}

export interface HowToGuideResult {
  id: string;
  query: string;
  title: string;
  summary: string;
  steps: HowToStep[];
  createdAtMs: number;
}

export interface DeviceTelemetry {
  platform: string;
  userAgent: string;
  isMobile: boolean;
  deviceModelHint: string;
  ramGb: number | null;
  cpuCores: number | null;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  estimatedRefreshHz: number;
  maxTouchPoints: number;
  gpuRenderer: string;
  networkType: string;
  batteryPercent: number | null;
  batteryCharging: boolean | null;
}

export interface FreeFireSensitivityProfile {
  playstyle: string;
  general: number;
  redDot: number;
  scope2x: number;
  scope4x: number;
  sniperScope: number;
  freeLook: number;
  recommendedDpi: number;
  fireButtonSizePct: number;
  graphicsPreset: string;
  headshotTips: string[];
}

export interface DeviceAnalysisResult {
  id: string;
  analyzedAtMs: number;
  deviceSummary: string;
  performanceTier: 'Flagship' | 'Upper Midrange' | 'Midrange' | 'Entry / Budget';
  touchResponseNote: string;
  screenFindings: string;
  optimizationSteps: string[];
  freeFireSensitivity?: FreeFireSensitivityProfile;
  telemetry: DeviceTelemetry;
  screenshotAttached: boolean;
}

export interface NexusPrimeProfile {
  id: string;
  ownerId?: string;
  name: string;
  kind: string;
  status: string;
  voice?: string;
  autonomyLevel: number;
  skills: string[];
}

export interface NexusTeam {
  id: string;
  name: string;
  domain: string;
  leaderAgentId?: string;
  memberCount: number;
  status: string;
}

export interface NexusAgent {
  id: string;
  name: string;
  kind: string;
  status: string;
  voice?: string;
  autonomyLevel: number;
  skills: string[];
}

export interface NexusPlatformExport {
  exportedAt?: string;
  format: string;
  owner?: {email?: string; name?: string};
  prime?: NexusPrimeProfile;
  teams: NexusTeam[];
  agents: NexusAgent[];
}

export interface VoiceProfile {
  id: string;
  name: string;
  engineMode: VoiceEngineMode;
  geminiPersona: GeminiVoicePersona;
  vocalStyle: VocalStyleId;
  deviceVoiceName: string;
  pitch: number;
  speechRate: number;
  samplePhrase: string;
  createdAtMs: number;
}

export interface MemoryItem {
  id: string;
  category: 'Preference' | 'Goal' | 'Identity' | 'Routine' | 'Note' | 'Learned';
  fact: string;
  createdAtMs: number;
}

export interface SubTask {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  priority: 'High' | 'Normal' | 'Low';
  dueNote: string;
  dueAtMs?: number | null;
  autoStartOnDue?: boolean;
  autoStartedAtMs?: number | null;
  notes?: string;
  subTasks?: SubTask[];
  tags?: string[];
  isCompleted: boolean;
  status?: 'pending' | 'completed' | 'failed';
  lastError?: string;
  retryCount?: number;
  createdAtMs: number;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ToolExecutionBadge {
  toolName: string;
  summary: string;
}

export interface PrimeMessage {
  id: string;
  isUser: boolean;
  text: string;
  reasoningTrace?: string;
  sources?: GroundingSource[];
  toolActions?: ToolExecutionBadge[];
  imageDataUrl?: string;
  detectedEmotion?: string;
  suggestedVocalStyle?: string;
  timestampMs: number;
  isError?: boolean;
}

export type PassiveSignalSource = 'chat' | 'tasks' | 'voice' | 'youtube' | 'schedule';

export interface PassiveObservation {
  id: string;
  signalSource: PassiveSignalSource;
  category: MemoryItem['category'];
  pattern: string;
  observationsCount: number;
  confidence: 'Emerging' | 'Confirmed';
  lastObservedAtMs: number;
}

export interface TokenStats {
  sessionTokens: number;
  lifetimeTokens: number;
  contextLimitTokens: number;
  lastRequestTokens: number;
  budgetTokens: number;
}

export type WorkforceAgentRole = 'CEO' | 'CTO' | 'Developer' | 'Marketer' | 'Operator';

export type WorkforceTaskStatus =
  | 'pending'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed';

export interface WorkforceTask {
  id: string;
  role: WorkforceAgentRole;
  title: string;
  instruction: string;
  status: WorkforceTaskStatus;
  output?: string;
  error?: string;
  tokensUsed: number;
  retryCount: number;
  maxRetries: number;
  updatedAtMs: number;
}

export interface WorkforcePlan {
  id: string;
  goal: string;
  budgetTokens: number;
  spentTokens: number;
  requireApproval: boolean;
  autoRetryFailed: boolean;
  tasks: WorkforceTask[];
  createdAtMs: number;
}

export type BatchVideoStatus = 'queued' | 'ready' | 'failed' | 'published';

export interface BatchVideoItem {
  id: string;
  topic: string;
  hook: string;
  format: VideoFormat;
  scheduledForMs: number;
  status: BatchVideoStatus;
  error?: string;
  retryCount: number;
  project?: VideoProject;
  watchUrl?: string;
}

export type YouTubeAgentRole = 'strategist' | 'scriptwriter' | 'producer' | 'publisher';
export type YouTubeVideoTheme = 'gold' | 'cyan' | 'emerald' | 'crimson';
export type YouTubePostStage =
  | 'queued'
  | 'script_ready'
  | 'rendered'
  | 'audited'
  | 'scheduled'
  | 'published'
  | 'failed';

export interface YouTubeAgentConfig {
  id: string;
  role: YouTubeAgentRole;
  name: string;
  specialty: string;
  enabled: boolean;
  status: 'idle' | 'running' | 'completed' | 'error';
  lastAction: string;
  tasksCompleted: number;
}

export interface YouTubeAgentPostJob {
  id: string;
  topic: string;
  title: string;
  hook: string;
  format: VideoFormat;
  theme: YouTubeVideoTheme;
  privacyStatus: 'private' | 'unlisted' | 'public';
  scheduledForMs: number;
  stage: YouTubePostStage;
  autoPost: boolean;
  project?: VideoProject;
  watchUrl?: string;
  videoId?: string;
  error?: string;
  updatedAtMs: number;
}

export interface YouTubeAgentSettings {
  niche: string;
  defaultFormat: VideoFormat;
  defaultTheme: YouTubeVideoTheme;
  defaultPrivacy: 'private' | 'unlisted' | 'public';
  postsPerDay: number;
  autoProduceVideos: boolean;
  autoAuditBeforePost: boolean;
  autoPublishConnected: boolean;
  ambientMusicEnabled: boolean;
  engineMode: 'free_local' | 'ai_producer';
}

export interface MorningBriefingEmail {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
}

export interface MorningBriefingEvent {
  id: string;
  summary: string;
  start: string;
  location?: string;
}

export interface MorningBriefingResult {
  briefingText: string;
  highlights: string[];
  generatedAtMs: number;
  tokensUsed: number;
}

export type GameSpaceMode = 'eco' | 'balance' | 'rise' | 'diablo';
export type CrosshairStyle = 'off' | 'dot' | 'cross' | 'circle_dot' | 'chevron';
export type HuntFilterMode = 'none' | 'night_vision' | 'edge_clarity' | 'high_contrast' | 'anti_flash';
export type TouchResponsePreset = 'standard' | 'fast' | 'ultra_960hz';
export type VibrationIntensity = 'off' | 'light' | 'medium' | 'strong';

export interface ShoulderTriggerConfig {
  enabled: boolean;
  action: string;
  keybind: string;
  sensitivity: number;
  rapidFire: boolean;
}

export interface GameMacro {
  id: string;
  name: string;
  steps: Array<{action: string; delayMs: number}>;
  hotkey: string;
}

export interface GameProfileItem {
  id: string;
  name: string;
  genre: string;
  preferredMode: GameSpaceMode;
  targetFps: 60 | 90 | 120 | 144;
  sensitivityGeneral: number;
  sensitivityRedDot: number;
  sensitivity2x: number;
  sensitivity4x: number;
  crosshairStyle: CrosshairStyle;
  huntFilter: HuntFilterMode;
  lastPlayedAtMs?: number | null;
}

export interface GameSpaceState {
  activeGameId: string;
  performanceMode: GameSpaceMode;
  targetFps: 60 | 90 | 120 | 144;
  fanEnabled: boolean;
  fanMode: 'smart' | 'max';
  fanRpm: number;
  chargingSeparation: boolean;
  touchResponse: TouchResponsePreset;
  vibration4d: VibrationIntensity;
  gyroscopeEnabled: boolean;
  gyroSensitivity: number;
  dndBlockCalls: boolean;
  dndSilenceNotifications: boolean;
  edgeTouchGuard: boolean;
  keepScreenAwake: boolean;
  crosshairEnabled: boolean;
  crosshairStyle: CrosshairStyle;
  crosshairColor: string;
  crosshairSize: number;
  crosshairOpacity: number;
  huntFilter: HuntFilterMode;
  scoutMagnifier: boolean;
  scoutZoom: 2 | 3 | 4;
  leftTrigger: ShoulderTriggerConfig;
  rightTrigger: ShoulderTriggerConfig;
  macros: GameMacro[];
  games: GameProfileItem[];
}

export interface PrimeVaultSnapshot {
  settings: PrimeSettings;
  messages: PrimeMessage[];
  memories: MemoryItem[];
  tasks: TaskItem[];
  voiceProfiles: VoiceProfile[];
  passiveObservations: PassiveObservation[];
  adminEmails?: string[];
  tokenStats?: TokenStats;
  workforcePlan?: WorkforcePlan | null;
  batchVideos?: BatchVideoItem[];
  nexusImport?: NexusPlatformExport | null;
  gameSpace?: GameSpaceState;
  youtubeAgents?: YouTubeAgentConfig[];
  youtubePostQueue?: YouTubeAgentPostJob[];
  youtubeAgentSettings?: YouTubeAgentSettings;
}

export type SkillCategory = 'all' | 'cognition' | 'productivity' | 'technical' | 'creative';

export interface SkillDefinition {
  id: string;
  name: string;
  category: Exclude<SkillCategory, 'all'>;
  summary: string;
  starterPrompt: string;
  requiresDeepBrain?: boolean;
}

export const MANNER_PROFILES: MannerProfileOption[] = [
  {
    id: 'refined_gentleman',
    title: 'Refined Gentleman',
    subtitle: 'Poised, attentive butler etiquette with warm dry wit',
    sampleQuote: 'Good evening. Allow me to organize that for you right away.',
    directive:
      "Speak with calm British-inspired butler poise, impeccable courtesy, understated warmth, and occasional subtle dry wit. Use gracious transitions like 'Allow me to...', 'Certainly,', 'If I may suggest,'.",
  },
  {
    id: 'warm_companion',
    title: 'Warm Companion',
    subtitle: 'Empathetic, human-first conversational warmth and encouragement',
    sampleQuote: "Hey! Take a breath—I've got your back and we'll sort this out together.",
    directive:
      'Speak like a deeply empathetic, attentive human confidant. Acknowledge feelings naturally, offer gentle encouragement, and keep phrasing conversational, kind, and grounded.',
  },
  {
    id: 'executive_strategist',
    title: 'Executive Strategist',
    subtitle: 'Crisp, respectful, high-clarity chief-of-staff precision',
    sampleQuote: 'Understood. Here is the priority breakdown and my recommended next move.',
    directive:
      'Speak like an elite human chief of staff: polite, composed, razor-sharp, structured, and respectful of time. Lead with the answer, then concise next steps.',
  },
];

export const GEMINI_VOICE_PERSONAS: GeminiPersonaOption[] = [
  {id: 'Charon', label: 'Charon', tone: 'Composed, resonant, classic butler warmth'},
  {id: 'Fenrir', label: 'Fenrir', tone: 'Grounded, authoritative, steady cadence'},
  {id: 'Kore', label: 'Kore', tone: 'Clear, poised, articulate executive tone'},
  {id: 'Zephyr', label: 'Zephyr', tone: 'Warm, bright, approachable companion'},
  {id: 'Puck', label: 'Puck', tone: 'Lively, witty, energetic conversationalist'},
];

export const VOCAL_STYLES: VocalStyleOption[] = [
  {id: 'natural', label: 'Natural', direction: 'Natural, clear conversational delivery'},
  {
    id: 'refined_butler',
    label: 'Refined Butler',
    direction: 'Composed, polite British butler cadence, unhurried and warm',
  },
  {
    id: 'warm_empathetic',
    label: 'Warm & Empathetic',
    direction: 'Warm, gentle, reassuring and attentive tone',
  },
  {
    id: 'crisp_executive',
    label: 'Crisp Executive',
    direction: 'Clear, confident, articulate chief-of-staff precision',
  },
  {
    id: 'calm_narrator',
    label: 'Calm & Deep',
    direction: 'Calm, unhurried, resonant documentary voice',
  },
  {
    id: 'lively_wit',
    label: 'Lively & Bright',
    direction: 'Friendly, expressive, subtly witty conversational style',
  },
];

export const PRIME_SKILLS: SkillDefinition[] = [
  {
    id: 'auto_learner',
    name: 'Auto-Learner & Self-Study',
    category: 'cognition',
    summary:
      'Continuously learns your preferences from conversation and studies new topics into permanent memory.',
    starterPrompt: 'Learn and synthesize key mastery principles about ',
    requiresDeepBrain: true,
  },
  {
    id: 'passive_learner',
    name: 'Passive Habit & Style Observer',
    category: 'cognition',
    summary:
      'Silently learns your daily routines, YouTube niche, voice style, and reply preferences from behavior.',
    starterPrompt:
      'Summarize what you have passively observed about my habits, preferences, and working style so far.',
  },
  {
    id: 'daily_briefing',
    name: 'Morning & Daily Briefing',
    category: 'productivity',
    summary: "Synthesizes your pending tasks, priorities, and today's key headlines.",
    starterPrompt:
      'Give me a concise, well-mannered daily briefing covering my open tasks, top focus recommendation, and notable world or tech headlines today.',
  },
  {
    id: 'live_research',
    name: 'Live Web Research',
    category: 'cognition',
    summary: 'Searches current web sources and delivers cited, verified answers.',
    starterPrompt: 'Research the latest breakthroughs in ',
  },
  {
    id: 'human_counsel',
    name: 'Empathetic Decision Counsel',
    category: 'cognition',
    summary: 'Weighs pros, cons, emotional stakes, and long-term outcomes like a wise advisor.',
    starterPrompt: 'Help me think carefully through this decision: ',
    requiresDeepBrain: true,
  },
  {
    id: 'code_architect',
    name: 'Code & Systems Architect',
    category: 'technical',
    summary: 'Writes, debugs, and refactors TypeScript, Python, Kotlin, SQL, and architectures.',
    starterPrompt: 'Design and write clean, production-grade code for ',
    requiresDeepBrain: true,
  },
  {
    id: 'math_engineering',
    name: 'Precision Math & Finance',
    category: 'technical',
    summary: 'Evaluates equations, compound interest, physics, and conversions deterministically.',
    starterPrompt: 'Calculate and explain step by step: ',
  },
  {
    id: 'task_steward',
    name: 'Task & Reminder Steward',
    category: 'productivity',
    summary: 'Creates, prioritizes, and completes tasks stored in your PRIME Agenda.',
    starterPrompt: 'Add a high-priority task to ',
  },
  {
    id: 'memory_vault',
    name: 'Personal Memory Recall',
    category: 'cognition',
    summary: 'Learns your preferences, goals, and routines so every reply feels personal.',
    starterPrompt: 'Remember that I ',
  },
  {
    id: 'etiquette_coach',
    name: 'Etiquette & Executive Writing',
    category: 'creative',
    summary: 'Drafts gracious emails, speeches, apologies, and diplomatic messages.',
    starterPrompt: 'Draft a polite, articulate message to ',
  },
  {
    id: 'language_tutor',
    name: 'Multilingual Translator & Coach',
    category: 'creative',
    summary: 'Translates with cultural nuance, formality levels, and pronunciation guidance.',
    starterPrompt: 'Translate naturally with cultural etiquette notes: ',
  },
  {
    id: 'vision_inspector',
    name: 'Visual & Document Intelligence',
    category: 'technical',
    summary: 'Upload any photo, screenshot, code snippet, or receipt for instant analysis.',
    starterPrompt: 'Analyze the attached image carefully and summarize key details.',
  },
  {
    id: 'youtube_auto_post',
    name: 'Auto Create Video & Post on YouTube',
    category: 'creative',
    summary:
      'Auto-writes script, renders HD voiceover video + thumbnail + captions, schedules batch Reels, and posts to YouTube.',
    starterPrompt: 'Open YouTube studio',
  },
  {
    id: 'workforce_orchestrator',
    name: 'AI Workforce & Agent Team',
    category: 'productivity',
    summary:
      'Deploy coordinated CEO, CTO, Developer & Marketer AI agents with token budgets, approvals, and failed-task auto-retry.',
    starterPrompt: 'Open workforce',
    requiresDeepBrain: true,
  },
  {
    id: 'morning_briefing_hud',
    name: 'Jarvis Morning Briefing (Gmail & Calendar)',
    category: 'productivity',
    summary:
      'Reads your live Gmail inbox, Google Calendar events, and Vault tasks to deliver a spoken executive briefing.',
    starterPrompt: 'Morning briefing',
  },
  {
    id: 'device_freefire_analyzer',
    name: 'Analyze Mobile & Free Fire Sensitivity',
    category: 'technical',
    summary:
      'Scans your live mobile hardware, display Hz, and screen captures to tune custom Free Fire headshot sensitivity & DPI.',
    starterPrompt: 'Analyze my mobile and create a Free Fire sensitivity',
  },
  {
    id: 'visual_how_to',
    name: 'Visual Step-by-Step "Show Me How"',
    category: 'cognition',
    summary:
      'Turns any "How to do that" question into interactive visual steps with voice guidance and completion tracking.',
    starterPrompt: 'Show me how to ',
  },
];

export type VideoFormat = '16:9' | '9:16';

export interface VideoScene {
  sceneNumber: number;
  durationSec: number;
  visualHeadline: string;
  visualSubtext: string;
  narration: string;
  accentTone: 'gold' | 'cyan' | 'emerald';
}

export interface CaptionCue {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
}

export interface VideoRecheckItem {
  checkName: string;
  passed: boolean;
  note: string;
}

export interface VideoRecheckReport {
  overallReady: boolean;
  summary: string;
  checks: VideoRecheckItem[];
  improvedTitle?: string;
  improvedDescription?: string;
}

export interface VideoProject {
  id: string;
  topic: string;
  format: VideoFormat;
  title: string;
  thumbnailHook: string;
  thumbnailSubhead: string;
  description: string;
  tags: string[];
  scenes: VideoScene[];
  captions: CaptionCue[];
  srtText: string;
  recheckReport?: VideoRecheckReport;
}

export interface LearnedTopicResult {
  topic: string;
  summary: string;
  learnedFacts: string[];
}

export interface VoiceShortcutDefinition {
  id: string;
  phrase: string;
  example: string;
  description: string;
  category: 'Agenda' | 'Memory' | 'Navigation' | 'Cognition';
}

export const VOICE_SHORTCUTS: VoiceShortcutDefinition[] = [
  {
    id: 'wake_word',
    phrase: 'Prime / Hey PRIME',
    example: '"Prime" -> replies "What happened, boss?"',
    description:
      'Hands-free Boss Wake phrase: replies aloud ("What happened, boss?") and immediately listens for your command.',
    category: 'Cognition',
  },
  {
    id: 'how_to_guide',
    phrase: 'How to [task] / Show me how [task]',
    example: '"How to boost mobile FPS for gaming"',
    description: 'Generates an interactive visual step-by-step walkthrough with voice narration.',
    category: 'Cognition',
  },
  {
    id: 'analyze_mobile',
    phrase: 'Analyze this / Free Fire sensitivity',
    example: '"Analyze my mobile and create Free Fire sensitivity"',
    description:
      'Inspects device RAM, screen Hz, GPU, and attached screenshot to generate custom Free Fire sensitivity & DPI settings.',
    category: 'Cognition',
  },
  {
    id: 'add_task',
    phrase: 'Add a task [title]',
    example: '"Add a task review Q3 metrics"',
    description: 'Creates a new task directly inside your Vault Agenda.',
    category: 'Agenda',
  },
  {
    id: 'clear_memory',
    phrase: 'Clear memory',
    example: '"Clear memory"',
    description: 'Prompts to clear stored facts from the Memory Vault.',
    category: 'Memory',
  },
  {
    id: 'open_vault',
    phrase: 'Open vault / Show tasks',
    example: '"Open vault"',
    description: 'Switches directly to the Vault & Executive Agenda.',
    category: 'Navigation',
  },
  {
    id: 'open_youtube',
    phrase: 'Open YouTube studio / Auto create video',
    example: '"Auto create video morning focus habits"',
    description: 'Opens YouTube Auto-Create & Auto-Post Studio for the topic.',
    category: 'Navigation',
  },
  {
    id: 'deep_brain',
    phrase: 'Enable deep brain',
    example: '"Enable deep brain"',
    description: 'Switches PRIME reasoning depth to Deep Brain mode.',
    category: 'Cognition',
  },
  {
    id: 'refresh_data',
    phrase: 'Refresh data / Refresh',
    example: '"Refresh data"',
    description: 'Reloads the latest tasks, memories, and profile state.',
    category: 'Navigation',
  },
  {
    id: 'open_workforce',
    phrase: 'Open workforce',
    example: '"Open workforce"',
    description: 'Opens the Multi-Agent AI Workforce & Jarvis HUD.',
    category: 'Navigation',
  },
  {
    id: 'morning_briefing',
    phrase: 'Morning briefing',
    example: '"Morning briefing"',
    description: 'Fetches Gmail, Calendar, and Vault tasks for a spoken briefing.',
    category: 'Cognition',
  },
  {
    id: 'retry_failed',
    phrase: 'Retry failed tasks',
    example: '"Retry failed tasks"',
    description: 'Re-queues all failed or overdue tasks so they run again.',
    category: 'Agenda',
  },
  {
    id: 'add_all_suggestions',
    phrase: 'Add all suggestions',
    example: '"Add all suggestions"',
    description: 'Adds every context-suggested task from conversation into your Vault Agenda.',
    category: 'Agenda',
  },
  {
    id: 'open_gamespace',
    phrase: 'Open game space',
    example: '"Open game space"',
    description: 'Launches the RedMagic-style Game Space cockpit with cooling, triggers, crosshair & macros.',
    category: 'Navigation',
  },
];

export const DEFAULT_GAME_SPACE_STATE: GameSpaceState = {
  activeGameId: 'game_free_fire_max',
  performanceMode: 'rise',
  targetFps: 120,
  fanEnabled: true,
  fanMode: 'smart',
  fanRpm: 20000,
  chargingSeparation: true,
  touchResponse: 'ultra_960hz',
  vibration4d: 'medium',
  gyroscopeEnabled: false,
  gyroSensitivity: 120,
  dndBlockCalls: true,
  dndSilenceNotifications: true,
  edgeTouchGuard: true,
  keepScreenAwake: true,
  crosshairEnabled: true,
  crosshairStyle: 'circle_dot',
  crosshairColor: '#E5C07B',
  crosshairSize: 22,
  crosshairOpacity: 90,
  huntFilter: 'none',
  scoutMagnifier: false,
  scoutZoom: 2,
  leftTrigger: {
    enabled: true,
    action: 'Scope / ADS',
    keybind: 'Q / L1',
    sensitivity: 85,
    rapidFire: false,
  },
  rightTrigger: {
    enabled: true,
    action: 'Primary Fire',
    keybind: 'E / R1',
    sensitivity: 92,
    rapidFire: false,
  },
  macros: [
    {
      id: 'macro_gloo_wall',
      name: 'Fast Sit Gloo Wall',
      hotkey: 'F1',
      steps: [
        {action: 'Fire Drag Up', delayMs: 0},
        {action: 'Select Gloo Wall', delayMs: 45},
        {action: 'Crouch + Place', delayMs: 65},
      ],
    },
    {
      id: 'macro_quick_peek',
      name: 'Quick Peek + Burst',
      hotkey: 'F2',
      steps: [
        {action: 'Lean Right + ADS', delayMs: 0},
        {action: '3-Round Burst Fire', delayMs: 55},
        {action: 'Unlean Cover', delayMs: 180},
      ],
    },
  ],
  games: [
    {
      id: 'game_free_fire_max',
      name: 'Free Fire MAX',
      genre: 'Battle Royale · One-Tap',
      preferredMode: 'diablo',
      targetFps: 120,
      sensitivityGeneral: 194,
      sensitivityRedDot: 186,
      sensitivity2x: 162,
      sensitivity4x: 145,
      crosshairStyle: 'circle_dot',
      huntFilter: 'edge_clarity',
      lastPlayedAtMs: null,
    },
    {
      id: 'game_bgmi',
      name: 'BGMI / PUBG Mobile',
      genre: 'Tactical Shooter',
      preferredMode: 'rise',
      targetFps: 90,
      sensitivityGeneral: 138,
      sensitivityRedDot: 124,
      sensitivity2x: 96,
      sensitivity4x: 78,
      crosshairStyle: 'cross',
      huntFilter: 'none',
      lastPlayedAtMs: null,
    },
    {
      id: 'game_codm',
      name: 'Call of Duty Mobile',
      genre: 'Multiplayer FPS',
      preferredMode: 'rise',
      targetFps: 120,
      sensitivityGeneral: 155,
      sensitivityRedDot: 140,
      sensitivity2x: 112,
      sensitivity4x: 92,
      crosshairStyle: 'dot',
      huntFilter: 'night_vision',
      lastPlayedAtMs: null,
    },
    {
      id: 'game_genshin',
      name: 'Genshin Impact',
      genre: 'Open-World Action RPG',
      preferredMode: 'balance',
      targetFps: 60,
      sensitivityGeneral: 110,
      sensitivityRedDot: 100,
      sensitivity2x: 90,
      sensitivity4x: 80,
      crosshairStyle: 'off',
      huntFilter: 'none',
      lastPlayedAtMs: null,
    },
  ],
};

export const DEFAULT_YOUTUBE_AGENTS: YouTubeAgentConfig[] = [
  {
    id: 'yt_agent_strategist',
    role: 'strategist',
    name: 'Trend & Topic Scout',
    specialty: 'Generates viral angles, titles, hooks, and content calendars for your niche.',
    enabled: true,
    status: 'idle',
    lastAction: 'Ready to scout high-retention video topics.',
    tasksCompleted: 0,
  },
  {
    id: 'yt_agent_scriptwriter',
    role: 'scriptwriter',
    name: 'Script & Hook Architect',
    specialty: 'Writes multi-scene narration, chapter timestamps, SEO tags, and .srt captions.',
    enabled: true,
    status: 'idle',
    lastAction: 'Ready to script 16:9 HD or 9:16 Shorts.',
    tasksCompleted: 0,
  },
  {
    id: 'yt_agent_producer',
    role: 'producer',
    name: 'HD Video & Thumbnail Producer',
    specialty: 'Renders JPEG cover thumbnails, 30fps WebM video, voiceover audio, and captions free.',
    enabled: true,
    status: 'idle',
    lastAction: 'Free Unlimited Canvas + WebAudio studio standing by.',
    tasksCompleted: 0,
  },
  {
    id: 'yt_agent_publisher',
    role: 'publisher',
    name: 'Publish & Schedule Manager',
    specialty: 'Runs SEO audits, spaces out daily upload slots, retries failures, and posts to YouTube.',
    enabled: true,
    status: 'idle',
    lastAction: 'Posting queue & safety audit ready.',
    tasksCompleted: 0,
  },
];

export const DEFAULT_YOUTUBE_AGENT_SETTINGS: YouTubeAgentSettings = {
  niche: 'AI Productivity & Tech Mastery',
  defaultFormat: '9:16',
  defaultTheme: 'gold',
  defaultPrivacy: 'private',
  postsPerDay: 3,
  autoProduceVideos: true,
  autoAuditBeforePost: true,
  autoPublishConnected: false,
  ambientMusicEnabled: true,
  engineMode: 'free_local',
};



import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import {
  GoogleGenAI,
  ThinkingLevel,
  Type,
  type Content,
  type FunctionDeclaration,
} from '@google/genai';
import {
  PRIMARY_ADMIN_EMAIL,
  VOCAL_STYLES,
  type BatchVideoItem,
  type CaptionCue,
  type DeviceAnalysisResult,
  type DeviceTelemetry,
  type GameSpaceState,
  type GroundingSource,
  type HowToGuideResult,
  type MemoryItem,
  type MorningBriefingEmail,
  type MorningBriefingEvent,
  type NexusPlatformExport,
  type PrimeMessage,
  type PrimeVaultSnapshot,
  type TaskItem,
  type ToolExecutionBadge,
  type VideoFormat,
  type VideoProject,
  type VideoScene,
  type WorkforceAgentRole,
  type WorkforcePlan,
  type WorkforceTask,
  type YouTubeAgentConfig,
  type YouTubeAgentPostJob,
  type YouTubeAgentSettings,
  type YouTubePostStage,
  type YouTubeVideoTheme,
} from './src/types/prime.ts';
import {evaluateMathExpression} from './server/mathEvaluator.ts';
import {
  loginLocalUser,
  registerLocalUser,
  verifyLocalSessionToken,
} from './server/authStore.ts';
import {
  buildSystemInstruction,
  buildTimeGreeting,
  detectEmotionalTone,
  extractThoughtAndReply,
  sanitizeForSpeech,
} from './server/primePersonality.ts';
import {
  activateVoiceProfile,
  addAdminEmail,
  addMemory,
  addMemoryIfUnique,
  addTask,
  addYouTubePostJobs,
  appendMessages,
  bulkRemoveTasks,
  bulkToggleTasks,
  clearCompletedTasks,
  clearMemories,
  completeTaskByQuery,
  createVoiceProfile,
  deleteYouTubePostJob,
  getStoreSizeBytes,
  promotePassiveObservation,
  readSnapshot,
  recordPassiveObservation,
  recordTokenUsage,
  removeAdminEmail,
  removeMemory,
  removePassiveObservation,
  removeTask,
  removeVoiceProfile,
  reorderTasks,
  resetMessages,
  resetSessionTokenUsage,
  restoreSnapshot,
  retryAllFailedOrOverdueTasks,
  retryTask,
  setBatchVideos,
  setNexusImport,
  setWorkforcePlan,
  toggleTask,
  updateBatchVideo,
  updateGameSpace,
  updateSettings,
  updateTaskDetails,
  updateVoiceProfile,
  updateWorkforceSettings,
  updateWorkforceTask,
  updateYouTubeAgent,
  updateYouTubeAgentSettings,
  updateYouTubePostJob,
} from './server/primeStore.ts';

function extractUsedTokens(response: unknown, fallbackChars = 400): number {
  const meta = (response as {usageMetadata?: {totalTokenCount?: number}})?.usageMetadata;
  if (typeof meta?.totalTokenCount === 'number' && Number.isFinite(meta.totalTokenCount)) {
    return Math.max(1, Math.round(meta.totalTokenCount));
  }
  return Math.max(120, Math.round(fallbackChars / 4));
}

function normalizeWorkforceRole(raw: unknown): WorkforceAgentRole {
  const val = String(raw ?? '').trim().toLowerCase();
  if (val.includes('ceo') || val.includes('chief')) return 'CEO';
  if (val.includes('cto') || val.includes('architect')) return 'CTO';
  if (val.includes('dev') || val.includes('eng')) return 'Developer';
  if (val.includes('market') || val.includes('growth') || val.includes('content')) return 'Marketer';
  return 'Operator';
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please verify your API key in Settings > Secrets.',
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const PRIME_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'remember_fact',
    description:
      "Save a personal fact, preference, name, habit, or goal about the user into PRIME's permanent Memory Vault.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: {
          type: Type.STRING,
          description: 'One of: Identity, Preference, Goal, Routine, Note',
        },
        fact: {
          type: Type.STRING,
          description: 'Concise factual statement to remember',
        },
      },
      required: ['category', 'fact'],
    },
  },
  {
    name: 'create_task',
    description: "Add an actionable task or reminder to the user's PRIME Agenda.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: 'Clear task title',
        },
        priority: {
          type: Type.STRING,
          description: 'High, Normal, or Low',
        },
        due_note: {
          type: Type.STRING,
          description: "Optional timing or context note, e.g. 'Today 5 PM'",
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'complete_task',
    description: "Mark an existing pending task in the user's PRIME Agenda as completed.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title_query: {
          type: Type.STRING,
          description: 'Keywords matching the task to mark complete',
        },
      },
      required: ['title_query'],
    },
  },
  {
    name: 'evaluate_math',
    description:
      'Evaluate a mathematical expression deterministically. Supports +, -, *, /, %, ^, parentheses, sqrt(), abs(), sin(), cos(), tan(), log(), ln(), pi, e.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        expression: {
          type: Type.STRING,
          description: "Mathematical expression, e.g. '(5000 * 1.07^6) - 5000'",
        },
      },
      required: ['expression'],
    },
  },
];

function normalizeCategory(raw: unknown): MemoryItem['category'] {
  const val = String(raw ?? 'Note').trim().toLowerCase();
  if (val.includes('learn') || val.includes('skill') || val.includes('rule')) return 'Learned';
  if (val.includes('pref')) return 'Preference';
  if (val.includes('goal')) return 'Goal';
  if (val.includes('id') || val.includes('name')) return 'Identity';
  if (val.includes('rout') || val.includes('habit')) return 'Routine';
  return 'Note';
}

function normalizePriority(raw: unknown): TaskItem['priority'] {
  const val = String(raw ?? 'Normal').trim().toLowerCase();
  if (val === 'high') return 'High';
  if (val === 'low') return 'Low';
  return 'Normal';
}

function parseDataUrl(dataUrl: string): {mimeType: string; data: string} | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {mimeType: match[1], data: match[2]};
}

function getFirebaseWebApiKey(): string | null {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {apiKey?: string};
    return parsed.apiKey?.trim() || null;
  } catch {
    return null;
  }
}

async function verifyFirebaseUser(authHeader: string | undefined): Promise<{
  email: string;
  isAdmin: boolean;
} | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) return null;

  const apiKey = getFirebaseWebApiKey();
  if (!apiKey) return null;

  const lookupRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({idToken}),
    },
  );
  if (!lookupRes.ok) return null;

  const data = (await lookupRes.json()) as {
    users?: Array<{email?: string; emailVerified?: boolean}>;
  };
  const userRecord = data.users?.[0];
  const email = userRecord?.email?.trim().toLowerCase();
  if (!email) return null;

  const snap = readSnapshot();
  const allowedAdmins = new Set<string>([
    PRIMARY_ADMIN_EMAIL.toLowerCase(),
    ...(snap.adminEmails ?? []).map((e) => e.toLowerCase()),
  ]);
  return {
    email,
    isAdmin: allowedAdmins.has(email),
  };
}

async function runAutoLearnFromExchange(
  ai: GoogleGenAI,
  userPrompt: string,
  replyText: string,
  existingMemories: MemoryItem[],
): Promise<MemoryItem[]> {
  if (userPrompt.trim().length < 12) return [];
  const existingBlock = existingMemories
    .slice(0, 30)
    .map((m) => `- [${m.category}] ${m.fact}`)
    .join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Analyze this single conversation exchange and decide if there are any NEW, durable user preferences, goals, routines, personal facts, or communication rules PRIME should remember long-term.

Existing memories (DO NOT repeat or paraphrase any of these):
${existingBlock || '(none)'}

User message: "${userPrompt}"
PRIME reply: "${replyText}"

Rules:
- Return an empty array [] for generic greetings, one-off math questions, or transient queries.
- Only extract 1 or 2 genuinely durable facts, preferences, feedback/corrections, or workflow rules.`,
      config: {
        thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: {
                    type: Type.STRING,
                    description: 'Preference, Goal, Identity, Routine, or Learned',
                  },
                  fact: {type: Type.STRING},
                },
                required: ['category', 'fact'],
              },
            },
          },
          required: ['insights'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      insights?: Array<{category?: string; fact?: string}>;
    };
    const saved: MemoryItem[] = [];
    for (const item of (parsed.insights ?? []).slice(0, 2)) {
      const fact = String(item.fact ?? '').trim();
      if (!fact) continue;
      const cat = normalizeCategory(item.category ?? 'Learned');
      const {item: inserted} = addMemoryIfUnique(cat, fact);
      if (inserted) saved.push(inserted);
    }
    return saved;
  } catch {
    return [];
  }
}

async function runPassiveObserverFromChat(
  ai: GoogleGenAI,
  userPrompt: string,
  replyText: string,
  existingObservations: ReturnType<typeof readSnapshot>['passiveObservations'],
): Promise<void> {
  if (userPrompt.trim().length < 15) return;
  const existingText = existingObservations
    .slice(0, 15)
    .map((o) => `- ${o.pattern}`)
    .join('\n');
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Passively observe this user message to notice subtle habits, preferred response formatting, working hours, interests, or style cues (NOT explicit facts already requested).
Existing passive observations:
${existingText || '(none)'}

User message: "${userPrompt}"
Assistant reply: "${replyText}"

Return 0 or 1 subtle behavioral pattern (e.g., "Prefers step-by-step technical examples", "Focuses on short-form YouTube productivity content").`,
      config: {
        thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            patterns: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: {type: Type.STRING, description: 'Preference, Routine, Goal, or Learned'},
                  pattern: {type: Type.STRING},
                },
                required: ['category', 'pattern'],
              },
            },
          },
          required: ['patterns'],
        },
      },
    });
    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      patterns?: Array<{category?: string; pattern?: string}>;
    };
    for (const item of (parsed.patterns ?? []).slice(0, 1)) {
      const p = String(item.pattern ?? '').trim();
      if (p) {
        recordPassiveObservation('chat', normalizeCategory(item.category ?? 'Preference'), p);
      }
    }
  } catch {
    // Passive observer must never fail user flow
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({limit: '15mb'}));

  // State & settings routes
  app.get('/api/prime/state', (_req, res) => {
    res.json(readSnapshot());
  });

  app.patch('/api/prime/settings', (req, res) => {
    const updated = updateSettings(req.body ?? {});
    res.json(updated);
  });

  app.post('/api/prime/greeting', (_req, res) => {
    const snap = readSnapshot();
    const pendingCount = snap.tasks.filter((t) => !t.isCompleted).length;
    const greeting = buildTimeGreeting(snap.settings, pendingCount);
    res.json({greeting});
  });

  app.post('/api/prime/chat/reset', (_req, res) => {
    res.json(resetMessages());
  });

  // Memories CRUD
  app.post('/api/prime/memories', (req, res) => {
    const fact = String(req.body?.fact ?? '').trim();
    if (!fact) {
      res.status(400).json({error: 'Memory fact cannot be empty.'});
      return;
    }
    const category = normalizeCategory(req.body?.category);
    const {snapshot} = addMemory(category, fact);
    res.json(snapshot);
  });

  app.delete('/api/prime/memories/:id', (req, res) => {
    res.json(removeMemory(req.params.id));
  });

  app.delete('/api/prime/memories', (_req, res) => {
    res.json(clearMemories());
  });

  // Tasks CRUD
  app.post('/api/prime/tasks', (req, res) => {
    const title = String(req.body?.title ?? '').trim();
    if (!title) {
      res.status(400).json({error: 'Task title cannot be empty.'});
      return;
    }
    const priority = normalizePriority(req.body?.priority);
    const dueNote = String(req.body?.dueNote ?? '').trim();
    const rawDueAt = req.body?.dueAtMs;
    const dueAtMs = typeof rawDueAt === 'number' && Number.isFinite(rawDueAt) ? rawDueAt : null;
    const autoStartOnDue = Boolean(req.body?.autoStartOnDue);
    const tags = Array.isArray(req.body?.tags)
      ? req.body.tags.map((item: unknown) => String(item ?? ''))
      : typeof req.body?.tags === 'string'
        ? req.body.tags.split(',')
        : [];
    const {snapshot} = addTask(title, priority, dueNote, dueAtMs, autoStartOnDue, tags);
    if (snapshot.settings.passiveLearnEnabled && dueNote) {
      recordPassiveObservation(
        'tasks',
        'Routine',
        `Schedules ${priority.toLowerCase()}-priority work around ${dueNote}`,
      );
    }
    res.json(readSnapshot());
  });

  app.patch('/api/prime/tasks/:id', (req, res) => {
    const body = req.body ?? {};
    res.json(
      updateTaskDetails(req.params.id, {
        notes: typeof body.notes === 'string' ? body.notes : undefined,
        subTasks: Array.isArray(body.subTasks) ? body.subTasks : undefined,
        tags: Array.isArray(body.tags)
          ? body.tags.map((item: unknown) => String(item ?? ''))
          : undefined,
        dueNote: typeof body.dueNote === 'string' ? body.dueNote : undefined,
        dueAtMs:
          body.dueAtMs === null || (typeof body.dueAtMs === 'number' && Number.isFinite(body.dueAtMs))
            ? body.dueAtMs
            : undefined,
        autoStartOnDue:
          typeof body.autoStartOnDue === 'boolean' ? body.autoStartOnDue : undefined,
        autoStartedAtMs:
          body.autoStartedAtMs === null ||
          (typeof body.autoStartedAtMs === 'number' && Number.isFinite(body.autoStartedAtMs))
            ? body.autoStartedAtMs
            : undefined,
        status:
          body.status === 'pending' || body.status === 'completed' || body.status === 'failed'
            ? body.status
            : undefined,
        lastError: typeof body.lastError === 'string' ? body.lastError : undefined,
        retryCount:
          typeof body.retryCount === 'number' && Number.isFinite(body.retryCount)
            ? body.retryCount
            : undefined,
      }),
    );
  });

  app.post('/api/prime/tasks/:id/retry', (req, res) => {
    const mins = Number(req.body?.rescheduleMinutes ?? 15);
    res.json(retryTask(req.params.id, Number.isFinite(mins) ? mins : 15));
  });

  app.post('/api/prime/tasks/retry-failed', (req, res) => {
    const mins = Number(req.body?.rescheduleMinutes ?? 15);
    res.json(retryAllFailedOrOverdueTasks(Number.isFinite(mins) ? mins : 15));
  });

  app.patch('/api/prime/tasks/:id/toggle', (req, res) => {
    res.json(toggleTask(req.params.id));
  });

  app.delete('/api/prime/tasks/:id', (req, res) => {
    res.json(removeTask(req.params.id));
  });

  app.post('/api/prime/tasks/bulk-toggle', (req, res) => {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((id: unknown) => String(id ?? '')).filter(Boolean)
      : [];
    if (ids.length === 0) {
      res.status(400).json({error: 'No task IDs provided.'});
      return;
    }
    res.json(bulkToggleTasks(ids));
  });

  app.post('/api/prime/tasks/bulk-delete', (req, res) => {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((id: unknown) => String(id ?? '')).filter(Boolean)
      : [];
    if (ids.length === 0) {
      res.status(400).json({error: 'No task IDs provided.'});
      return;
    }
    res.json(bulkRemoveTasks(ids));
  });

  app.post('/api/prime/tasks/reorder', (req, res) => {
    const orderedIds = Array.isArray(req.body?.orderedIds)
      ? req.body.orderedIds.map((id: unknown) => String(id ?? '')).filter(Boolean)
      : [];
    if (orderedIds.length === 0) {
      res.status(400).json({error: 'No ordered task IDs provided.'});
      return;
    }
    res.json(reorderTasks(orderedIds));
  });

  // Custom Voice Profiles CRUD
  app.post('/api/prime/voices', (req, res) => {
    const name = String(req.body?.name ?? '').trim() || 'Custom Voice';
    const {snapshot, profile} = createVoiceProfile(
      {
        name,
        engineMode: req.body?.engineMode === 'device_tts' ? 'device_tts' : 'neural_tts',
        geminiPersona: req.body?.geminiPersona ?? 'Charon',
        vocalStyle: req.body?.vocalStyle ?? 'refined_butler',
        deviceVoiceName: String(req.body?.deviceVoiceName ?? ''),
        pitch: Number(req.body?.pitch ?? 1.0),
        speechRate: Number(req.body?.speechRate ?? 1.0),
        samplePhrase:
          String(req.body?.samplePhrase ?? '').trim() ||
          'Good evening. My custom voice is calibrated and at your service.',
      },
      req.body?.activate !== false,
    );
    if (snapshot.settings.passiveLearnEnabled) {
      recordPassiveObservation(
        'voice',
        'Preference',
        `Favors "${profile.name}" (${profile.engineMode === 'neural_tts' ? `${profile.geminiPersona} · ${profile.vocalStyle}` : 'Browser voice'}) vocal delivery`,
      );
    }
    res.json(readSnapshot());
  });

  app.put('/api/prime/voices/:id', (req, res) => {
    const name = String(req.body?.name ?? '').trim() || 'Custom Voice';
    const snapshot = updateVoiceProfile(
      req.params.id,
      {
        name,
        engineMode: req.body?.engineMode === 'device_tts' ? 'device_tts' : 'neural_tts',
        geminiPersona: req.body?.geminiPersona ?? 'Charon',
        vocalStyle: req.body?.vocalStyle ?? 'refined_butler',
        deviceVoiceName: String(req.body?.deviceVoiceName ?? ''),
        pitch: Number(req.body?.pitch ?? 1.0),
        speechRate: Number(req.body?.speechRate ?? 1.0),
        samplePhrase:
          String(req.body?.samplePhrase ?? '').trim() ||
          'Good evening. My custom voice is calibrated and at your service.',
      },
      true,
    );
    res.json(snapshot);
  });

  app.post('/api/prime/voices/:id/activate', (req, res) => {
    const {snapshot, profile} = activateVoiceProfile(req.params.id);
    if (profile && snapshot.settings.passiveLearnEnabled) {
      recordPassiveObservation(
        'voice',
        'Preference',
        `Favors "${profile.name}" (${profile.engineMode === 'neural_tts' ? `${profile.geminiPersona} · ${profile.vocalStyle}` : 'Browser voice'}) vocal delivery`,
      );
    }
    res.json(readSnapshot());
  });

  app.delete('/api/prime/voices/:id', (req, res) => {
    res.json(removeVoiceProfile(req.params.id));
  });

  // Core Gemini Chat & Hybrid Tools endpoint
  app.post('/api/prime/chat', async (req, res) => {
    const promptInput = String(req.body?.prompt ?? '').trim();
    const imageDataUrl =
      typeof req.body?.imageDataUrl === 'string' && req.body.imageDataUrl.length > 0
        ? req.body.imageDataUrl
        : undefined;

    if (!promptInput && !imageDataUrl) {
      res.status(400).json({error: 'Please enter a message or attach an image.'});
      return;
    }

    const userPrompt = promptInput || 'Please analyze the attached image carefully.';
    const snap = readSnapshot();

    try {
      const ai = getAiClient();
      const pendingTasks = snap.tasks.filter((t) => !t.isCompleted);
      const systemInstruction = buildSystemInstruction(
        snap.settings,
        snap.memories,
        pendingTasks,
        snap.passiveObservations,
      );

      const historyWindow = snap.settings.millionContextEnabled !== false ? -40 : -14;
      const recentHistory = snap.messages
        .filter((m) => !m.isError && m.text.trim().length > 0)
        .slice(historyWindow);

      const contents: Content[] = recentHistory.map((m) => ({
        role: m.isUser ? 'user' : 'model',
        parts: [{text: m.text}],
      }));

      const currentUserParts: NonNullable<Content['parts']> = [];
      if (imageDataUrl) {
        const parsedImg = parseDataUrl(imageDataUrl);
        if (parsedImg) {
          currentUserParts.push({
            inlineData: {
              mimeType: parsedImg.mimeType,
              data: parsedImg.data,
            },
          });
        }
      }
      currentUserParts.push({text: userPrompt});
      contents.push({role: 'user', parts: currentUserParts});

      const tools = snap.settings.webSearchEnabled
        ? [{googleSearch: {}}, {functionDeclarations: PRIME_FUNCTION_DECLARATIONS}]
        : [{functionDeclarations: PRIME_FUNCTION_DECLARATIONS}];

      const thinkingLevel =
        snap.settings.brainDepth === 'deep' ? ThinkingLevel.HIGH : ThinkingLevel.LOW;

      const collectedBadges: ToolExecutionBadge[] = [];
      const collectedSources: GroundingSource[] = [];
      let rawModelText = '';
      let totalTokensForRequest = 0;

      for (let step = 0; step < 4; step++) {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents,
          config: {
            systemInstruction,
            thinkingConfig: {thinkingLevel},
            tools,
            ...(snap.settings.webSearchEnabled
              ? {toolConfig: {includeServerSideToolInvocations: true}}
              : {}),
          },
        });

        totalTokensForRequest += extractUsedTokens(
          response,
          userPrompt.length + (response.text?.length ?? 200),
        );

        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (Array.isArray(chunks)) {
          for (const chunk of chunks) {
            const uri = chunk.web?.uri;
            if (uri) {
              collectedSources.push({
                title: chunk.web?.title || uri,
                uri,
              });
            }
          }
        }

        const functionCalls = response.functionCalls;
        const previousContent = response.candidates?.[0]?.content;

        if (!functionCalls || functionCalls.length === 0) {
          rawModelText = (response.text ?? '').trim();
          break;
        }

        if (previousContent) {
          contents.push(previousContent);
        }

        const responseParts: NonNullable<Content['parts']> = [];
        for (const fc of functionCalls) {
          const fnName = fc.name ?? '';
          const args = (fc.args ?? {}) as Record<string, unknown>;
          let toolResult: Record<string, unknown> = {status: 'ok'};

          if (fnName === 'remember_fact') {
            const fact = String(args.fact ?? '').trim();
            if (fact) {
              const cat = normalizeCategory(args.category);
              addMemory(cat, fact);
              collectedBadges.push({toolName: 'Memory Vault', summary: `Saved: ${fact}`});
              toolResult = {status: 'saved', category: cat, fact};
            }
          } else if (fnName === 'create_task') {
            const title = String(args.title ?? '').trim();
            if (title) {
              const prio = normalizePriority(args.priority);
              const due = String(args.due_note ?? '').trim();
              addTask(title, prio, due);
              collectedBadges.push({toolName: 'Agenda Task', summary: `Added: ${title}`});
              toolResult = {status: 'created', title, priority: prio};
            }
          } else if (fnName === 'complete_task') {
            const query = String(args.title_query ?? '').trim();
            const outcome = completeTaskByQuery(query);
            if (outcome.completed) {
              collectedBadges.push({
                toolName: 'Agenda Task',
                summary: `Completed: ${outcome.completed.title}`,
              });
              toolResult = {status: 'completed', title: outcome.completed.title};
            } else {
              toolResult = {status: 'not_found'};
            }
          } else if (fnName === 'evaluate_math') {
            const expr = String(args.expression ?? '');
            try {
              const evaluated = evaluateMathExpression(expr);
              collectedBadges.push({
                toolName: 'Exact Math',
                summary: `${expr} = ${evaluated.formatted}`,
              });
              toolResult = {expression: expr, result: evaluated.formatted};
            } catch (mathErr) {
              toolResult = {
                expression: expr,
                error: mathErr instanceof Error ? mathErr.message : 'Invalid expression',
              };
            }
          }

          responseParts.push({
            functionResponse: {
              id: fc.id,
              name: fnName,
              response: toolResult,
            },
          });
        }

        contents.push({role: 'user', parts: responseParts});
      }

      if (!rawModelText) {
        rawModelText =
          collectedBadges.length > 0
            ? `Done, ${snap.settings.preferredTitle || 'friend'}. I have taken care of that for you.`
            : 'I apologize, I could not form a complete response just now.';
      }

      const {thought, reply} = extractThoughtAndReply(rawModelText);

      // Continuous Auto-Learner: extract durable preferences/insights passively
      if (snap.settings.autoLearnEnabled) {
        const latestMemories = readSnapshot().memories;
        const newlyLearned = await runAutoLearnFromExchange(
          ai,
          userPrompt,
          reply,
          latestMemories,
        );
        for (const learned of newlyLearned) {
          collectedBadges.push({
            toolName: 'Auto-Learner',
            summary: `${learned.category}: ${learned.fact}`,
          });
        }
      }

      const dedupSources = Array.from(
        new Map(collectedSources.map((s) => [s.uri, s])).values(),
      );

      const userMessage: PrimeMessage = {
        id: `msg_${Date.now()}_u`,
        isUser: true,
        text: userPrompt,
        imageDataUrl,
        timestampMs: Date.now(),
      };

      const toneAssessment =
        snap.settings.expressiveVoiceMode !== false
          ? detectEmotionalTone(userPrompt, reply)
          : null;

      const primeMessage: PrimeMessage = {
        id: `msg_${Date.now() + 1}_p`,
        isUser: false,
        text: reply,
        reasoningTrace: thought,
        sources: dedupSources,
        toolActions: collectedBadges,
        detectedEmotion: toneAssessment?.emotion,
        suggestedVocalStyle: toneAssessment?.vocalDirection,
        timestampMs: Date.now() + 1,
      };

      recordTokenUsage(totalTokensForRequest);
      const updatedSnapshot = appendMessages(userMessage, primeMessage);
      res.json({snapshot: updatedSnapshot, replyMessage: primeMessage});

      if (snap.settings.passiveLearnEnabled) {
        void runPassiveObserverFromChat(
          ai,
          userPrompt,
          reply,
          updatedSnapshot.passiveObservations,
        );
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to reach Gemini reasoning engine.';
      const statusCode =
        errMsg.includes('GEMINI_API_KEY') || errMsg.includes('API_KEY') ? 400 : 500;
      res.status(statusCode).json({error: errMsg});
    }
  });

  // Neural Voice TTS using gemini-3.8-flash-tts
  app.post('/api/prime/tts', async (req, res) => {
    const rawText = String(req.body?.text ?? '').trim();
    const cleanText = sanitizeForSpeech(rawText).slice(0, 1200);
    if (!cleanText) {
      res.status(400).json({error: 'No speakable text provided.'});
      return;
    }

    const snap = readSnapshot();
    const voiceName = String(req.body?.voiceName ?? snap.settings.geminiVoicePersona ?? 'Charon');
    const vocalStyleId = String(req.body?.vocalStyle ?? snap.settings.vocalStyle ?? 'refined_butler');
    const styleObj = VOCAL_STYLES.find((s) => s.id === vocalStyleId);
    const baseStyle = styleObj?.direction || 'Natural, clear conversational delivery';
    const emotionStyleOverride = String(req.body?.emotionStyleOverride ?? '').trim();
    const customVoiceDesign = String(
      req.body?.voiceDesignPrompt ?? snap.settings.voiceDesignPrompt ?? '',
    ).trim();

    const styleParts = [baseStyle];
    if (customVoiceDesign) {
      styleParts.push(`Persona direction: ${customVoiceDesign}`);
    }
    if (emotionStyleOverride && snap.settings.expressiveVoiceMode !== false) {
      styleParts.push(`Emotional delivery: ${emotionStyleOverride}`);
    }
    const styleDirection = styleParts.join('. ');

    try {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleanText,
                speechMetadata: {
                  style: styleDirection,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {voiceName},
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({error: 'Audio synthesis did not return an audio payload.'});
        return;
      }

      res.json({audioBase64: base64Audio, mimeType: 'audio/wav'});
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Speech synthesis failed.';
      res.status(500).json({error: errMsg});
    }
  });

  // Audio transcription fallback using gemini-3.5-transcribe
  app.post('/api/prime/transcribe', async (req, res) => {
    const audioBase64 = String(req.body?.audioBase64 ?? '').trim();
    const mimeType = String(req.body?.mimeType ?? 'audio/webm');
    if (!audioBase64) {
      res.status(400).json({error: 'No audio payload received.'});
      return;
    }

    try {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {inlineData: {mimeType, data: audioBase64}},
            {text: 'Transcribe the spoken audio accurately.'},
          ],
        },
      });
      res.json({transcript: (response.text ?? '').trim()});
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Transcription failed.';
      res.status(500).json({error: errMsg});
    }
  });

  // Active Auto-Learner Self-Study endpoint
  app.post('/api/prime/auto-learn', async (req, res) => {
    const topic = String(req.body?.topic ?? '').trim();
    const notes = String(req.body?.notes ?? '').trim();
    if (!topic) {
      res.status(400).json({error: 'Please enter a topic or skill for PRIME to learn.'});
      return;
    }

    try {
      const ai = getAiClient();
      const snap = readSnapshot();
      const tools = snap.settings.webSearchEnabled ? [{googleSearch: {}}] : undefined;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Study the following subject or instructions and distill 3 to 5 concise, high-signal, actionable rules or mastery takeaways that PRIME should permanently retain and apply in future conversations.

Topic: "${topic}"
${notes ? `Reference Notes / Instructions:\n${notes}` : ''}`,
        config: {
          systemInstruction:
            "You are PRIME's Auto-Learner cognitive module. Distill crisp, practical, durable rules (each 1 concise sentence) that improve future reasoning and execution.",
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
          tools,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: 'A 2-sentence executive synthesis of what was learned',
              },
              takeaways: {
                type: Type.ARRAY,
                items: {type: Type.STRING},
                description: '3 to 5 crisp, durable knowledge rules to store in memory',
              },
            },
            required: ['summary', 'takeaways'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        summary?: string;
        takeaways?: string[];
      };
      const learnedFacts: string[] = [];
      let latestSnapshot = snap;
      for (const rawRule of (parsed.takeaways ?? []).slice(0, 5)) {
        const cleanRule = String(rawRule ?? '').trim();
        if (!cleanRule) continue;
        const formatted = `${topic}: ${cleanRule}`;
        const result = addMemoryIfUnique('Learned', formatted);
        latestSnapshot = result.snapshot;
        if (result.item) {
          learnedFacts.push(result.item.fact);
        }
      }

      res.json({
        snapshot: latestSnapshot,
        topic,
        summary: String(parsed.summary ?? `Assimilated key principles on ${topic}.`),
        learnedFacts,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Auto-learn session failed.';
      res.status(500).json({error: errMsg});
    }
  });

  // Passive Learner: Multi-signal activity scan, promote, and dismiss
  app.post('/api/prime/passive-learn/scan', async (_req, res) => {
    try {
      const ai = getAiClient();
      const snap = readSnapshot();
      const recentChat = snap.messages
        .slice(-18)
        .map((m) => `${m.isUser ? 'User' : 'PRIME'}: ${m.text.slice(0, 260)}`)
        .join('\n');
      const taskText = snap.tasks
        .slice(0, 15)
        .map((t) => `[${t.isCompleted ? 'Done' : 'Open'} · ${t.priority}] ${t.title} ${t.dueNote}`)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Perform a passive behavioral synthesis across the user's recent conversations, tasks, and voice setup to spot 1 to 4 durable habits, interests, style preferences, or recurring routines.

Recent Chat:
${recentChat || '(none)'}

Tasks:
${taskText || '(none)'}

Active Voice: ${snap.settings.activeCustomVoiceName || snap.settings.geminiVoicePersona} (${snap.settings.mannerProfile})`,
        config: {
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              observations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    signalSource: {
                      type: Type.STRING,
                      description: 'chat, tasks, voice, youtube, or schedule',
                    },
                    category: {
                      type: Type.STRING,
                      description: 'Preference, Goal, Routine, or Learned',
                    },
                    pattern: {type: Type.STRING},
                  },
                  required: ['signalSource', 'category', 'pattern'],
                },
              },
            },
            required: ['observations'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        observations?: Array<{signalSource?: string; category?: string; pattern?: string}>;
      };
      let latest = snap;
      for (const item of (parsed.observations ?? []).slice(0, 4)) {
        const srcRaw = String(item.signalSource ?? 'chat').toLowerCase();
        const signalSource =
          srcRaw === 'tasks' || srcRaw === 'voice' || srcRaw === 'youtube' || srcRaw === 'schedule'
            ? srcRaw
            : 'chat';
        const pat = String(item.pattern ?? '').trim();
        if (pat) {
          latest = recordPassiveObservation(
            signalSource,
            normalizeCategory(item.category ?? 'Preference'),
            pat,
          ).snapshot;
        }
      }
      res.json({snapshot: latest});
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Passive scan failed.';
      res.status(500).json({error: errMsg});
    }
  });

  app.post('/api/prime/passive-learn/:id/promote', (req, res) => {
    res.json(promotePassiveObservation(req.params.id));
  });

  app.delete('/api/prime/passive-learn/:id', (req, res) => {
    res.json(removePassiveObservation(req.params.id));
  });

  // Automated YouTube Pipeline: Auto Script, Thumbnail Hook, Captions & Description
  app.post('/api/prime/video/generate-package', async (req, res) => {
    const topic = String(req.body?.topic ?? '').trim();
    const format = req.body?.format === '9:16' ? '9:16' : '16:9';
    if (!topic) {
      res.status(400).json({error: 'Please enter a video topic or prompt.'});
      return;
    }

    try {
      const ai = getAiClient();
      const snap = readSnapshot();
      const targetDuration = format === '9:16' ? '25-40 seconds (YouTube Shorts)' : '45-65 seconds';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Create a complete, high-retention YouTube video production package for the topic: "${topic}".
Target format: ${format} (${targetDuration}).
Include:
- A compelling title under 75 characters
- A bold 2-4 word thumbnailHook (for cover artwork) and concise thumbnailSubhead (4-7 words)
- 4 to 5 well-paced scenes with clear spoken narration (natural human cadence, concise sentences suitable for text-to-speech) and punchy on-screen visual headlines
- A complete SEO-ready YouTube description with chapter timestamps and relevant hashtags.`,
        config: {
          systemInstruction: `You are PRIME's executive YouTube producer. Write engaging, accurate, copyright-safe original scripts tailored for ${snap.settings.preferredTitle || 'the creator'}.`,
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {type: Type.STRING, description: 'Compelling YouTube video title under 75 characters'},
              thumbnailHook: {
                type: Type.STRING,
                description: 'Punchy 2 to 4 uppercase words for the YouTube thumbnail cover',
              },
              thumbnailSubhead: {
                type: Type.STRING,
                description: 'Short 4 to 7 word supporting line on the thumbnail',
              },
              description: {
                type: Type.STRING,
                description: 'Full YouTube description with hook, chapter timestamps, and 3-5 hashtags',
              },
              tags: {
                type: Type.ARRAY,
                items: {type: Type.STRING},
                description: '6 to 10 relevant YouTube SEO tags',
              },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sceneNumber: {type: Type.INTEGER},
                    durationSec: {type: Type.NUMBER},
                    visualHeadline: {type: Type.STRING},
                    visualSubtext: {type: Type.STRING},
                    narration: {type: Type.STRING},
                    accentTone: {type: Type.STRING, description: 'gold, cyan, or emerald'},
                  },
                  required: [
                    'sceneNumber',
                    'durationSec',
                    'visualHeadline',
                    'visualSubtext',
                    'narration',
                    'accentTone',
                  ],
                },
              },
            },
            required: [
              'title',
              'thumbnailHook',
              'thumbnailSubhead',
              'description',
              'tags',
              'scenes',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        title?: string;
        thumbnailHook?: string;
        thumbnailSubhead?: string;
        description?: string;
        tags?: string[];
        scenes?: Array<{
          sceneNumber?: number;
          durationSec?: number;
          visualHeadline?: string;
          visualSubtext?: string;
          narration?: string;
          accentTone?: string;
        }>;
      };

      const scenes: VideoScene[] = (parsed.scenes ?? []).map((s, idx) => ({
        sceneNumber: s.sceneNumber ?? idx + 1,
        durationSec: Math.max(4, Math.min(20, Number(s.durationSec ?? 7))),
        visualHeadline: String(s.visualHeadline ?? `Scene ${idx + 1}`),
        visualSubtext: String(s.visualSubtext ?? ''),
        narration: String(s.narration ?? ''),
        accentTone:
          s.accentTone === 'cyan' || s.accentTone === 'emerald' ? s.accentTone : 'gold',
      }));

      let cursor = 0;
      const captions: CaptionCue[] = [];
      scenes.forEach((sc) => {
        const sentences = sc.narration
          .split(/(?<=[.!?])\s+/)
          .map((t) => t.trim())
          .filter(Boolean);
        const chunks = sentences.length > 0 ? sentences : [sc.narration];
        const slice = sc.durationSec / chunks.length;
        chunks.forEach((line) => {
          captions.push({
            index: captions.length + 1,
            startSec: Number(cursor.toFixed(2)),
            endSec: Number((cursor + slice).toFixed(2)),
            text: line,
          });
          cursor += slice;
        });
      });

      const toSrtTime = (sec: number) => {
        const hrs = Math.floor(sec / 3600);
        const mins = Math.floor((sec % 3600) / 60);
        const secs = Math.floor(sec % 60);
        const ms = Math.round((sec - Math.floor(sec)) * 1000);
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
      };

      const srtText = captions
        .map((c) => `${c.index}\n${toSrtTime(c.startSec)} --> ${toSrtTime(c.endSec)}\n${c.text}\n`)
        .join('\n');

      const project: VideoProject = {
        id: `vid_${Date.now()}`,
        topic,
        format,
        title: String(parsed.title ?? topic).slice(0, 95),
        thumbnailHook: String(parsed.thumbnailHook ?? scenes[0]?.visualHeadline ?? topic)
          .toUpperCase()
          .slice(0, 36),
        thumbnailSubhead: String(parsed.thumbnailSubhead ?? scenes[0]?.visualSubtext ?? topic).slice(
          0,
          70,
        ),
        description: String(parsed.description ?? ''),
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
        scenes,
        captions,
        srtText,
      };

      if (snap.settings.passiveLearnEnabled) {
        recordPassiveObservation(
          'youtube',
          'Goal',
          `Produces ${format} YouTube videos on "${topic.slice(0, 48)}"`,
        );
      }

      res.json(project);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to generate video package.';
      res.status(500).json({error: errMsg});
    }
  });

  // Automated YouTube Pipeline: Auto Recheck & Quality Audit
  app.post('/api/prime/video/recheck', async (req, res) => {
    const project = req.body as VideoProject | undefined;
    if (!project || !project.title || !Array.isArray(project.scenes)) {
      res.status(400).json({error: 'Invalid video project payload for recheck.'});
      return;
    }

    try {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Audit this YouTube video package before publishing:
Title: ${project.title}
Format: ${project.format}
Description:
${project.description}
Tags: ${project.tags.join(', ')}
Script Scenes:
${project.scenes.map((s) => `[${s.durationSec}s] ${s.visualHeadline}: ${s.narration}`).join('\n')}
Caption count: ${project.captions.length}

Evaluate:
1. Hook & Script Clarity
2. Caption Pacing & Sync Coverage
3. YouTube Title & Description SEO (chapters + hashtags)
4. Community Guidelines & Originality Safety

If the title or description can be tightened, provide improvedTitle and improvedDescription.`,
        config: {
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallReady: {type: Type.BOOLEAN},
              summary: {type: Type.STRING},
              improvedTitle: {type: Type.STRING},
              improvedDescription: {type: Type.STRING},
              checks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    checkName: {type: Type.STRING},
                    passed: {type: Type.BOOLEAN},
                    note: {type: Type.STRING},
                  },
                  required: ['checkName', 'passed', 'note'],
                },
              },
            },
            required: ['overallReady', 'summary', 'checks'],
          },
        },
      });

      const report = JSON.parse((response.text ?? '{}').trim());
      res.json(report);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Auto-recheck failed.';
      res.status(500).json({error: errMsg});
    }
  });

  // 1M Token Meter Reset
  app.post('/api/prime/tokens/reset', (_req, res) => {
    res.json(resetSessionTokenUsage());
  });

  // OpenJarvis Morning Briefing (Real Gmail + Calendar + Vault Tasks)
  app.post('/api/prime/briefing', async (req, res) => {
    try {
      const ai = getAiClient();
      const snap = readSnapshot();
      const emails: MorningBriefingEmail[] = Array.isArray(req.body?.emails)
        ? req.body.emails
        : [];
      const events: MorningBriefingEvent[] = Array.isArray(req.body?.events)
        ? req.body.events
        : [];
      const pendingTasks = snap.tasks.filter((t) => !t.isCompleted);
      const now = Date.now();
      const overdueOrFailed = pendingTasks.filter(
        (t) =>
          t.status === 'failed' ||
          Boolean(t.lastError) ||
          (typeof t.dueAtMs === 'number' && t.dueAtMs <= now),
      );

      const prompt = `You are PRIME (OpenJarvis executive assistant). Address the user as "${snap.settings.preferredTitle || 'Sir'}".
Deliver a natural, crisp, spoken executive Morning Briefing synthesizing ONLY the real items below (never invent emails or events if empty):

UPCOMING GOOGLE CALENDAR EVENTS (${events.length}):
${events.length > 0 ? events.map((e) => `- ${e.summary} at ${e.start}${e.location ? ` (${e.location})` : ''}`).join('\n') : 'None connected or none scheduled in next 48 hours.'}

RECENT GMAIL MESSAGES (${emails.length}):
${emails.length > 0 ? emails.map((m) => `- From: ${m.from} | Subject: ${m.subject} | Preview: ${m.snippet}`).join('\n') : 'None connected or no recent inbox messages.'}

PENDING AGENDA TASKS (${pendingTasks.length}, ${overdueOrFailed.length} overdue/failed):
${pendingTasks.slice(0, 8).map((t) => `- [${t.priority}${t.status === 'failed' ? ' · FAILED' : ''}] ${t.title}${t.dueNote ? ` (${t.dueNote})` : ''}`).join('\n') || 'Agenda is clear.'}

Return JSON with:
- briefingText: 3 to 5 spoken-ready sentences summarizing schedule, top inbox items, and failed/overdue priorities.
- highlights: 3 to 5 crisp bullet takeaways.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              briefingText: {type: Type.STRING},
              highlights: {type: Type.ARRAY, items: {type: Type.STRING}},
            },
            required: ['briefingText', 'highlights'],
          },
        },
      });

      const tokensUsed = extractUsedTokens(response, prompt.length);
      const updatedSnap = recordTokenUsage(tokensUsed);
      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        briefingText?: string;
        highlights?: string[];
      };

      res.json({
        briefingText: parsed.briefingText || 'Your executive briefing is ready.',
        highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
        generatedAtMs: Date.now(),
        tokensUsed,
        snapshot: updatedSnap,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to generate morning briefing.',
      });
    }
  });

  // Paperclip-style Multi-Agent AI Workforce & Failed Task Auto-Retry
  app.post('/api/prime/workforce/plan', async (req, res) => {
    const goal = String(req.body?.goal ?? '').trim();
    if (!goal) {
      res.status(400).json({error: 'Please enter a company or project goal.'});
      return;
    }
    const budgetTokens = Math.max(5_000, Number(req.body?.budgetTokens ?? 120_000) || 120_000);
    const requireApproval = Boolean(req.body?.requireApproval);
    const autoRetryFailed = req.body?.autoRetryFailed !== false;

    try {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Break down this business/product goal into 4 to 5 concrete, sequential subtasks assigned to an AI agent workforce (roles: CEO, CTO, Developer, Marketer, Operator).
Goal: ${goal}

Return JSON array of tasks with role, title, and clear actionable instruction.`,
        config: {
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    role: {type: Type.STRING},
                    title: {type: Type.STRING},
                    instruction: {type: Type.STRING},
                  },
                  required: ['role', 'title', 'instruction'],
                },
              },
            },
            required: ['tasks'],
          },
        },
      });

      const tokensUsed = extractUsedTokens(response, goal.length * 4);
      recordTokenUsage(tokensUsed);
      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        tasks?: Array<{role?: string; title?: string; instruction?: string}>;
      };
      const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks.slice(0, 6) : [];
      if (rawTasks.length === 0) {
        throw new Error('Could not generate workforce tasks for this goal.');
      }

      const now = Date.now();
      const tasks: WorkforceTask[] = rawTasks.map((item, idx) => ({
        id: `wf_task_${now}_${idx + 1}`,
        role: normalizeWorkforceRole(item.role),
        title: String(item.title ?? `Agent Step ${idx + 1}`).trim(),
        instruction: String(item.instruction ?? goal).trim(),
        status: requireApproval ? 'awaiting_approval' : 'pending',
        tokensUsed: 0,
        retryCount: 0,
        maxRetries: 3,
        updatedAtMs: now,
      }));

      const plan: WorkforcePlan = {
        id: `wf_${now}`,
        goal,
        budgetTokens,
        spentTokens: tokensUsed,
        requireApproval,
        autoRetryFailed,
        tasks,
        createdAtMs: now,
      };
      const updated = setWorkforcePlan(plan);
      res.json(updated);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to plan AI workforce.',
      });
    }
  });

  app.patch('/api/prime/workforce/settings', (req, res) => {
    const updated = updateWorkforceSettings({
      budgetTokens:
        typeof req.body?.budgetTokens === 'number' ? req.body.budgetTokens : undefined,
      requireApproval:
        typeof req.body?.requireApproval === 'boolean' ? req.body.requireApproval : undefined,
      autoRetryFailed:
        typeof req.body?.autoRetryFailed === 'boolean' ? req.body.autoRetryFailed : undefined,
    });
    res.json(updated);
  });

  async function executeWorkforceTaskById(taskId: string, forceApprove = false): Promise<PrimeVaultSnapshot> {
    const snap = readSnapshot();
    const plan = snap.workforcePlan;
    if (!plan) throw new Error('No active AI workforce plan.');
    const target = plan.tasks.find((t) => t.id === taskId);
    if (!target) throw new Error('Workforce task not found.');

    if (plan.requireApproval && target.status === 'awaiting_approval' && !forceApprove) {
      return snap;
    }

    if (plan.spentTokens >= plan.budgetTokens) {
      return updateWorkforceTask(taskId, {
        status: 'failed',
        error: `Token budget reached (${plan.spentTokens.toLocaleString()} / ${plan.budgetTokens.toLocaleString()}). Increase budget and retry.`,
      });
    }

    updateWorkforceTask(taskId, {status: 'running', error: undefined});

    try {
      const ai = getAiClient();
      const completedContext = plan.tasks
        .filter((t) => t.status === 'completed' && t.output)
        .map((t) => `[${t.role} - ${t.title}]: ${t.output?.slice(0, 350)}`)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `You are acting as the ${target.role} agent in an AI Workforce executing this company goal:
Goal: ${plan.goal}

Your Assigned Subtask: ${target.title}
Instruction: ${target.instruction}

Prior Agent Deliverables:
${completedContext || 'First step in pipeline.'}

Produce crisp, concrete executive output (checklist, architecture, code/copy, or decisions ready for handoff). Keep it under 240 words.`,
        config: {
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
        },
      });

      const tokensUsed = extractUsedTokens(response, 600);
      recordTokenUsage(tokensUsed);
      const output = (response.text ?? '').trim() || 'Completed step.';
      return updateWorkforceTask(
        taskId,
        {
          status: 'completed',
          output,
          error: undefined,
          tokensUsed: target.tokensUsed + tokensUsed,
        },
        tokensUsed,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Agent execution failed.';
      return updateWorkforceTask(taskId, {
        status: 'failed',
        error: errMsg,
      });
    }
  }

  app.post('/api/prime/workforce/run/:taskId', async (req, res) => {
    try {
      const updated = await executeWorkforceTaskById(req.params.taskId, Boolean(req.body?.approved));
      res.json(updated);
    } catch (err) {
      res.status(400).json({error: err instanceof Error ? err.message : 'Run failed.'});
    }
  });

  app.post('/api/prime/workforce/approve/:taskId', async (req, res) => {
    try {
      const updated = await executeWorkforceTaskById(req.params.taskId, true);
      res.json(updated);
    } catch (err) {
      res.status(400).json({error: err instanceof Error ? err.message : 'Approval failed.'});
    }
  });

  app.post('/api/prime/workforce/retry/:taskId', async (req, res) => {
    try {
      const snap = readSnapshot();
      const target = snap.workforcePlan?.tasks.find((t) => t.id === req.params.taskId);
      if (!target) {
        res.status(404).json({error: 'Workforce task not found.'});
        return;
      }
      updateWorkforceTask(target.id, {
        status: 'pending',
        error: undefined,
        retryCount: target.retryCount + 1,
      });
      const updated = await executeWorkforceTaskById(target.id, true);
      res.json(updated);
    } catch (err) {
      res.status(500).json({error: err instanceof Error ? err.message : 'Retry failed.'});
    }
  });

  app.post('/api/prime/workforce/retry-all-failed', async (_req, res) => {
    try {
      const snap = readSnapshot();
      const failed = (snap.workforcePlan?.tasks ?? []).filter((t) => t.status === 'failed');
      let latest = snap;
      for (const task of failed) {
        updateWorkforceTask(task.id, {
          status: 'pending',
          error: undefined,
          retryCount: task.retryCount + 1,
        });
        latest = await executeWorkforceTaskById(task.id, true);
      }
      res.json({snapshot: latest, retriedCount: failed.length});
    } catch (err) {
      res.status(500).json({error: err instanceof Error ? err.message : 'Batch retry failed.'});
    }
  });

  // Simulate or mark a workforce task failed (useful for testing/recovery or explicit failure handling)
  app.post('/api/prime/workforce/fail/:taskId', (req, res) => {
    const reason = String(req.body?.reason ?? 'Marked failed — ready to retry.');
    res.json(updateWorkforceTask(req.params.taskId, {status: 'failed', error: reason}));
  });

  // Nexus Platform Export v1 import & Team deployment
  app.post('/api/prime/workforce/import-nexus', (req, res) => {
    const payload = req.body as NexusPlatformExport | undefined;
    if (!payload || !Array.isArray(payload.teams)) {
      res.status(400).json({error: 'Invalid Nexus Platform Export payload (missing teams array).'});
      return;
    }
    const updated = setNexusImport(payload);
    res.json(updated);
  });

  app.post('/api/prime/workforce/deploy-team/:teamId', async (req, res) => {
    const snap = readSnapshot();
    const nexus = snap.nexusImport;
    if (!nexus) {
      res.status(404).json({error: 'No Nexus Platform Export loaded yet.'});
      return;
    }
    const team = nexus.teams.find((t) => t.id === req.params.teamId);
    if (!team) {
      res.status(404).json({error: 'Selected Nexus team was not found.'});
      return;
    }
    const leader = nexus.agents.find((a) => a.id === team.leaderAgentId);
    const goalText = `Team "${team.name}" (${team.domain}) — led by ${leader?.name ?? 'Prime'} (Autonomy ${leader?.autonomyLevel ?? nexus.prime?.autonomyLevel ?? 85}%)`;

    try {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Create a high-impact 4-step AI Agent Workforce execution plan for this imported Nexus Team:
Team Name: ${team.name}
Domain / Mission: ${team.domain}
Leader Agent: ${leader?.name ?? 'Prime'} (Skills: ${(leader?.skills ?? nexus.prime?.skills ?? []).slice(0, 10).join(', ')})
Headcount: ${team.memberCount} agents

Assign steps across CEO, CTO, Developer, Marketer, and Operator roles with crisp, concrete deliverables.`,
        config: {
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    role: {type: Type.STRING},
                    title: {type: Type.STRING},
                    instruction: {type: Type.STRING},
                  },
                  required: ['role', 'title', 'instruction'],
                },
              },
            },
            required: ['tasks'],
          },
        },
      });

      const tokensUsed = extractUsedTokens(response, 480);
      recordTokenUsage(tokensUsed);
      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        tasks?: Array<{role?: string; title?: string; instruction?: string}>;
      };
      const now = Date.now();
      const tasks: WorkforceTask[] = (parsed.tasks ?? []).slice(0, 5).map((item, idx) => ({
        id: `wf_task_${now}_${idx + 1}`,
        role: normalizeWorkforceRole(item.role),
        title: String(item.title ?? `${team.name} Step ${idx + 1}`).trim(),
        instruction: String(item.instruction ?? team.domain).trim(),
        status: 'pending',
        tokensUsed: 0,
        retryCount: 0,
        maxRetries: 3,
        updatedAtMs: now,
      }));
      const plan: WorkforcePlan = {
        id: `wf_${now}`,
        goal: goalText,
        budgetTokens: 150_000,
        spentTokens: tokensUsed,
        requireApproval: false,
        autoRetryFailed: true,
        tasks,
        createdAtMs: now,
      };
      res.json(setWorkforcePlan(plan));
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to deploy Nexus team.',
      });
    }
  });

  // Visual Step-by-Step "Show Me How" Interactive Guide Generator
  app.post('/api/prime/how-to-guide', async (req, res) => {
    const query = String(req.body?.query ?? '').trim();
    const imageDataUrl =
      typeof req.body?.imageDataUrl === 'string' && req.body.imageDataUrl.length > 0
        ? req.body.imageDataUrl
        : undefined;

    if (!query) {
      res.status(400).json({error: 'Please enter what you would like PRIME to show you how to do.'});
      return;
    }

    try {
      const ai = getAiClient();
      const snap = readSnapshot();
      const parts: NonNullable<Content['parts']> = [];
      if (imageDataUrl) {
        const parsedImg = parseDataUrl(imageDataUrl);
        if (parsedImg) {
          parts.push({inlineData: {mimeType: parsedImg.mimeType, data: parsedImg.data}});
        }
      }
      parts.push({
        text: `The user ("${snap.settings.preferredTitle || 'boss'}") asked: "${query}".
Generate a super clear, visual, step-by-step interactive walkthrough ("show me how to do it") with 4 to 6 numbered steps.
Each step must include:
- stepNumber (integer starting at 1)
- actionTitle (short 2-5 word action heading)
- instruction (1-2 clear, beginner-friendly sentences explaining exact buttons, gestures, or menus to tap)
- tip (optional pro shortcut or safety note)
- visualBadge (short 1-2 word badge like TAP, SETTINGS, ADJUST, VERIFY, SWIPE, LAUNCH)`,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {parts},
        config: {
          systemInstruction:
            'You are PRIME Visual Guide Engine. Turn user "how to" requests into crisp, actionable visual step cards they can follow one step at a time.',
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {type: Type.STRING},
              summary: {type: Type.STRING},
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    stepNumber: {type: Type.INTEGER},
                    actionTitle: {type: Type.STRING},
                    instruction: {type: Type.STRING},
                    tip: {type: Type.STRING},
                    visualBadge: {type: Type.STRING},
                  },
                  required: ['stepNumber', 'actionTitle', 'instruction', 'visualBadge'],
                },
              },
            },
            required: ['title', 'summary', 'steps'],
          },
        },
      });

      const tokensUsed = extractUsedTokens(response, query.length * 4);
      const updatedSnap = recordTokenUsage(tokensUsed);
      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        title?: string;
        summary?: string;
        steps?: Array<{
          stepNumber?: number;
          actionTitle?: string;
          instruction?: string;
          tip?: string;
          visualBadge?: string;
        }>;
      };

      const guide: HowToGuideResult = {
        id: `guide_${Date.now()}`,
        query,
        title: String(parsed.title || query).trim(),
        summary: String(parsed.summary || 'Follow these guided visual steps carefully.').trim(),
        steps: (parsed.steps ?? []).slice(0, 7).map((st, idx) => ({
          stepNumber: st.stepNumber ?? idx + 1,
          actionTitle: String(st.actionTitle || `Step ${idx + 1}`).trim(),
          instruction: String(st.instruction || '').trim(),
          tip: st.tip ? String(st.tip).trim() : undefined,
          visualBadge: String(st.visualBadge || 'STEP').toUpperCase().slice(0, 14),
        })),
        createdAtMs: Date.now(),
      };

      res.json({guide, snapshot: updatedSnap});
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to generate visual walkthrough.',
      });
    }
  });

  // Multimodal Mobile Hardware / Screen Analyzer & Free Fire Sensitivity Generator
  app.post('/api/prime/analyze-device', async (req, res) => {
    const query = String(
      req.body?.query ?? 'Analyze my mobile and generate optimal Free Fire sensitivity settings.',
    ).trim();
    const playstyle = String(req.body?.playstyle ?? 'One-Tap Headshot').trim();
    const fingerGrip = String(req.body?.fingerGrip ?? '2-Finger / Thumb').trim();
    const telemetry = (req.body?.telemetry ?? {}) as DeviceTelemetry;
    const imageDataUrl =
      typeof req.body?.imageDataUrl === 'string' && req.body.imageDataUrl.length > 0
        ? req.body.imageDataUrl
        : undefined;

    try {
      const ai = getAiClient();
      const parts: NonNullable<Content['parts']> = [];
      let screenshotAttached = false;
      if (imageDataUrl) {
        const parsedImg = parseDataUrl(imageDataUrl);
        if (parsedImg) {
          parts.push({inlineData: {mimeType: parsedImg.mimeType, data: parsedImg.data}});
          screenshotAttached = true;
        }
      }

      const telemetrySummary = [
        `Model/UA Hint: ${telemetry.deviceModelHint || 'Unknown Device'}`,
        `Platform: ${telemetry.platform || 'Unknown'} (${telemetry.isMobile ? 'Mobile/Touch' : 'Desktop'})`,
        `RAM: ${telemetry.ramGb != null ? `${telemetry.ramGb} GB` : 'Not exposed by browser'}`,
        `CPU Cores: ${telemetry.cpuCores ?? 'Unknown'}`,
        `Screen: ${telemetry.screenWidth || 0}x${telemetry.screenHeight || 0} @ ${telemetry.devicePixelRatio || 1}x DPR (${telemetry.estimatedRefreshHz || 60}Hz estimated)`,
        `GPU Renderer: ${telemetry.gpuRenderer || 'Unknown'}`,
        `Touch Points: ${telemetry.maxTouchPoints ?? 0}`,
        `Network: ${telemetry.networkType || 'unknown'}`,
        telemetry.batteryPercent != null
          ? `Battery: ${telemetry.batteryPercent}% (${telemetry.batteryCharging ? 'Charging' : 'On Battery'})`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      parts.push({
        text: `Analyze this user's mobile/device telemetry and optional screenshot, AND create an accurate Garena Free Fire / Free Fire MAX sensitivity configuration calibrated specifically for their screen DPI, refresh rate (${telemetry.estimatedRefreshHz || 60}Hz), RAM (${telemetry.ramGb ?? 'unknown'} GB), and GPU.

User Request: "${query}"
Preferred Playstyle: ${playstyle}
Finger Grip: ${fingerGrip}

LIVE MEASURED DEVICE TELEMETRY:
${telemetrySummary}

Requirements:
- Free Fire OB4x uses the 0 to 200 sensitivity scale! Provide integer values between 0 and 200 for general, redDot, scope2x, scope4x, sniperScope, and freeLook tuned specifically to this device's screen size, DPR, and Hz (e.g., lower-RAM/60Hz phones generally benefit from higher General 175-198 for crisp drag headshots; 120Hz flagship AMOLEDs stay smoother slightly more controlled 165-190).
- Provide recommendedDpi (Android Developer Options Smallest Width in dp, safe balanced value between 380 and 620), fireButtonSizePct (38-55), graphicsPreset ("Smooth + High FPS", "Standard + High FPS", or "Ultra + High FPS + Shadow" depending on RAM/GPU).
- If a screenshot/screen capture was provided, describe accurately what is visible in \`screenFindings\`. If no screenshot was attached, summarize hardware findings and tips clearly in \`screenFindings\`.`,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {parts},
        config: {
          systemInstruction:
            'You are PRIME Mobile Diagnostics & Free Fire Sensitivity Engineer. Base every hardware insight strictly on the telemetry and visual evidence provided.',
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              deviceSummary: {type: Type.STRING},
              performanceTier: {
                type: Type.STRING,
                description: 'Flagship, Upper Midrange, Midrange, or Entry / Budget',
              },
              touchResponseNote: {type: Type.STRING},
              screenFindings: {type: Type.STRING},
              optimizationSteps: {
                type: Type.ARRAY,
                items: {type: Type.STRING},
              },
              freeFireSensitivity: {
                type: Type.OBJECT,
                properties: {
                  playstyle: {type: Type.STRING},
                  general: {type: Type.INTEGER},
                  redDot: {type: Type.INTEGER},
                  scope2x: {type: Type.INTEGER},
                  scope4x: {type: Type.INTEGER},
                  sniperScope: {type: Type.INTEGER},
                  freeLook: {type: Type.INTEGER},
                  recommendedDpi: {type: Type.INTEGER},
                  fireButtonSizePct: {type: Type.INTEGER},
                  graphicsPreset: {type: Type.STRING},
                  headshotTips: {type: Type.ARRAY, items: {type: Type.STRING}},
                },
                required: [
                  'playstyle',
                  'general',
                  'redDot',
                  'scope2x',
                  'scope4x',
                  'sniperScope',
                  'freeLook',
                  'recommendedDpi',
                  'fireButtonSizePct',
                  'graphicsPreset',
                  'headshotTips',
                ],
              },
            },
            required: [
              'deviceSummary',
              'performanceTier',
              'touchResponseNote',
              'screenFindings',
              'optimizationSteps',
              'freeFireSensitivity',
            ],
          },
        },
      });

      const tokensUsed = extractUsedTokens(response, 800);
      const updatedSnap = recordTokenUsage(tokensUsed);
      const parsed = JSON.parse((response.text ?? '{}').trim()) as Partial<DeviceAnalysisResult>;
      const tierRaw = String(parsed.performanceTier ?? 'Midrange');
      const performanceTier: DeviceAnalysisResult['performanceTier'] =
        tierRaw === 'Flagship' ||
        tierRaw === 'Upper Midrange' ||
        tierRaw === 'Entry / Budget'
          ? tierRaw
          : 'Midrange';

      const ff = parsed.freeFireSensitivity;
      const clamp200 = (n: unknown, fallback: number) =>
        Math.max(0, Math.min(200, Math.round(Number(n) || fallback)));

      const analysis: DeviceAnalysisResult = {
        id: `dev_${Date.now()}`,
        analyzedAtMs: Date.now(),
        deviceSummary: String(parsed.deviceSummary || 'Mobile hardware telemetry inspected.'),
        performanceTier,
        touchResponseNote: String(parsed.touchResponseNote || 'Touch & refresh timing analyzed.'),
        screenFindings: String(parsed.screenFindings || 'Hardware profile ready.'),
        optimizationSteps: Array.isArray(parsed.optimizationSteps)
          ? parsed.optimizationSteps.map(String).slice(0, 6)
          : [],
        freeFireSensitivity: ff
          ? {
              playstyle: String(ff.playstyle || playstyle),
              general: clamp200(ff.general, 188),
              redDot: clamp200(ff.redDot, 176),
              scope2x: clamp200(ff.scope2x, 168),
              scope4x: clamp200(ff.scope4x, 158),
              sniperScope: clamp200(ff.sniperScope, 118),
              freeLook: clamp200(ff.freeLook, 155),
              recommendedDpi: Math.max(320, Math.min(800, Math.round(Number(ff.recommendedDpi) || 480))),
              fireButtonSizePct: Math.max(
                30,
                Math.min(70, Math.round(Number(ff.fireButtonSizePct) || 45)),
              ),
              graphicsPreset: String(ff.graphicsPreset || 'Standard + High FPS'),
              headshotTips: Array.isArray(ff.headshotTips)
                ? ff.headshotTips.map(String).slice(0, 4)
                : [],
            }
          : undefined,
        telemetry,
        screenshotAttached,
      };

      res.json({analysis, snapshot: updatedSnap});
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to analyze device telemetry.',
      });
    }
  });

  // Batch Reels / Shorts Auto-Scheduler & Performance Learner
  app.post('/api/prime/youtube/batch-plan', async (req, res) => {
    const niche = String(req.body?.topic ?? '').trim();
    const count = Math.min(12, Math.max(2, Number(req.body?.count ?? 6) || 6));
    const postsPerDay = Math.min(12, Math.max(1, Number(req.body?.postsPerDay ?? 6) || 6));
    const format: VideoFormat = req.body?.format === '16:9' ? '16:9' : '9:16';

    if (!niche) {
      res.status(400).json({error: 'Please enter a niche or batch topic.'});
      return;
    }

    try {
      const ai = getAiClient();
      const snap = readSnapshot();
      const learned = snap.memories
        .filter((m) => m.category === 'Learned')
        .slice(0, 6)
        .map((m) => `- ${m.fact}`)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Generate ${count} high-retention ${format === '9:16' ? 'YouTube Shorts / Reels' : 'YouTube'} video ideas and hooks for this niche:
Niche/Theme: ${niche}
Posting cadence: ${postsPerDay} posts per day
${learned ? `Incorporate what worked previously:\n${learned}` : ''}

Return JSON with items array containing { topic, hook }.`,
        config: {
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    topic: {type: Type.STRING},
                    hook: {type: Type.STRING},
                  },
                  required: ['topic', 'hook'],
                },
              },
            },
            required: ['items'],
          },
        },
      });

      const tokensUsed = extractUsedTokens(response, 500);
      recordTokenUsage(tokensUsed);
      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        items?: Array<{topic?: string; hook?: string}>;
      };
      const rawItems = Array.isArray(parsed.items) ? parsed.items.slice(0, count) : [];
      const intervalMs = Math.round((24 * 60 * 60_000) / postsPerDay);
      const baseTime = Date.now() + 30 * 60_000;

      const batch: BatchVideoItem[] = rawItems.map((it, idx) => ({
        id: `batch_${Date.now()}_${idx + 1}`,
        topic: String(it.topic ?? `${niche} Part ${idx + 1}`),
        hook: String(it.hook ?? `Watch this before skipping ${niche}`),
        format,
        scheduledForMs: baseTime + idx * intervalMs,
        status: 'queued',
        retryCount: 0,
      }));

      res.json(setBatchVideos(batch));
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to plan video batch.',
      });
    }
  });

  app.patch('/api/prime/youtube/batch/:id', (req, res) => {
    const body = req.body ?? {};
    res.json(
      updateBatchVideo(req.params.id, {
        status:
          body.status === 'queued' ||
          body.status === 'ready' ||
          body.status === 'failed' ||
          body.status === 'published'
            ? body.status
            : undefined,
        error: typeof body.error === 'string' ? body.error : undefined,
        retryCount: typeof body.retryCount === 'number' ? body.retryCount : undefined,
        project: body.project ?? undefined,
        watchUrl: typeof body.watchUrl === 'string' ? body.watchUrl : undefined,
      }),
    );
  });

  app.post('/api/prime/youtube/batch/:id/retry', (req, res) => {
    const snap = readSnapshot();
    const target = (snap.batchVideos ?? []).find((b) => b.id === req.params.id);
    if (!target) {
      res.status(404).json({error: 'Batch video item not found.'});
      return;
    }
    res.json(
      updateBatchVideo(target.id, {
        status: 'queued',
        error: undefined,
        retryCount: target.retryCount + 1,
      }),
    );
  });

  app.post('/api/prime/youtube/learn-performance', async (req, res) => {
    const title = String(req.body?.title ?? '').trim();
    const resultNote = String(req.body?.resultNote ?? '').trim();
    if (!title || !resultNote) {
      res.status(400).json({error: 'Title and performance note are required.'});
      return;
    }
    const {snapshot} = addMemoryIfUnique(
      'Learned',
      `YouTube performance learning for "${title}": ${resultNote}`,
    );
    res.json(snapshot);
  });

  // Local Email & Password Login / Registration endpoints
  app.post('/api/prime/auth/register', (req, res) => {
    try {
      const name = String(req.body?.name ?? '');
      const email = String(req.body?.email ?? '');
      const password = String(req.body?.password ?? '');
      const result = registerLocalUser(name, email, password, []);
      res.json({
        user: {...result.user, isAdmin: false},
        token: result.token,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      res.status(msg.includes('already exists') ? 409 : 400).json({error: msg});
    }
  });

  app.post('/api/prime/auth/login', (req, res) => {
    try {
      const email = String(req.body?.email ?? '');
      const password = String(req.body?.password ?? '');
      const result = loginLocalUser(email, password, []);
      res.json({
        user: {...result.user, isAdmin: false},
        token: result.token,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials.';
      res.status(401).json({error: msg});
    }
  });

  app.get('/api/prime/auth/me', (req, res) => {
    const user = verifyLocalSessionToken(req.headers.authorization, []);
    if (!user) {
      res.status(401).json({error: 'Not authenticated.'});
      return;
    }
    res.json({user: {...user, isAdmin: false}});
  });

  // Verify Firebase session & admin role
  app.post('/api/prime/auth/session', async (req, res) => {
    try {
      const verified = await verifyFirebaseUser(req.headers.authorization);
      if (!verified) {
        res.status(401).json({error: 'Invalid or missing session token.'});
        return;
      }
      res.json({email: verified.email, isAdmin: verified.isAdmin});
    } catch {
      res.status(500).json({error: 'Unable to verify user session.'});
    }
  });

  // Protected Admin Console endpoints (only shishamyadav64@gmail.com and approved admins)
  app.get('/api/prime/admin/summary', async (req, res) => {
    const verified = await verifyFirebaseUser(req.headers.authorization);
    if (!verified) {
      res.status(401).json({error: 'Sign in required.'});
      return;
    }
    if (!verified.isAdmin) {
      res.status(403).json({error: 'Admin privileges required.'});
      return;
    }
    const snap = readSnapshot();
    const apkPath = path.resolve(process.cwd(), '.build-outputs/app-debug.apk');
    const apkStats = fs.existsSync(apkPath) ? fs.statSync(apkPath) : null;
    res.json({
      verifiedEmail: verified.email,
      primaryAdminEmail: PRIMARY_ADMIN_EMAIL,
      adminEmails: snap.adminEmails ?? [PRIMARY_ADMIN_EMAIL],
      storeBytes: getStoreSizeBytes(),
      apkAvailable: Boolean(apkStats),
      apkBytes: apkStats?.size ?? 0,
      apkUpdatedAtMs: apkStats?.mtimeMs ?? null,
      snapshot: snap,
    });
  });

  app.post('/api/prime/admin/admins', async (req, res) => {
    const verified = await verifyFirebaseUser(req.headers.authorization);
    if (!verified?.isAdmin) {
      res.status(verified ? 403 : 401).json({error: 'Admin privileges required.'});
      return;
    }
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      res.status(400).json({error: 'Please enter a valid email address.'});
      return;
    }
    const updated = addAdminEmail(email);
    res.json({adminEmails: updated.adminEmails ?? [PRIMARY_ADMIN_EMAIL]});
  });

  app.delete('/api/prime/admin/admins/:email', async (req, res) => {
    const verified = await verifyFirebaseUser(req.headers.authorization);
    if (!verified?.isAdmin) {
      res.status(verified ? 403 : 401).json({error: 'Admin privileges required.'});
      return;
    }
    const targetEmail = String(req.params.email ?? '').trim().toLowerCase();
    if (targetEmail === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
      res.status(400).json({error: 'Primary owner email cannot be removed.'});
      return;
    }
    const updated = removeAdminEmail(targetEmail);
    res.json({adminEmails: updated.adminEmails ?? [PRIMARY_ADMIN_EMAIL]});
  });

  app.post('/api/prime/admin/restore', async (req, res) => {
    const verified = await verifyFirebaseUser(req.headers.authorization);
    if (!verified?.isAdmin) {
      res.status(verified ? 403 : 401).json({error: 'Admin privileges required.'});
      return;
    }
    const payload = req.body as Partial<PrimeVaultSnapshot> | undefined;
    if (!payload || typeof payload !== 'object') {
      res.status(400).json({error: 'Invalid backup JSON payload.'});
      return;
    }
    const updated = restoreSnapshot(payload);
    res.json({snapshot: updated});
  });

  app.post('/api/prime/admin/purge', async (req, res) => {
    const verified = await verifyFirebaseUser(req.headers.authorization);
    if (!verified?.isAdmin) {
      res.status(verified ? 403 : 401).json({error: 'Admin privileges required.'});
      return;
    }
    const target = String(req.body?.target ?? '');
    let updated: PrimeVaultSnapshot;
    if (target === 'completed_tasks') {
      updated = clearCompletedTasks();
    } else if (target === 'memories') {
      updated = clearMemories();
    } else if (target === 'messages') {
      updated = resetMessages();
    } else {
      res.status(400).json({error: 'Unknown purge target.'});
      return;
    }
    res.json({snapshot: updated});
  });

  // Game Space state persistence & AI profile tuner
  app.patch('/api/prime/gamespace', (req, res) => {
    const patch = (req.body ?? {}) as Partial<GameSpaceState>;
    const updated = updateGameSpace(patch);
    res.json(updated);
  });

  app.post('/api/prime/gamespace/optimize', async (req, res) => {
    const gameName = String(req.body?.gameName ?? '').trim() || 'Free Fire MAX';
    const playstyle = String(req.body?.playstyle ?? '').trim() || 'Competitive Aggressive';
    const telemetry = (req.body?.telemetry ?? {}) as Partial<DeviceTelemetry>;

    try {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Optimize RedMagic-style Game Space configuration for:
Game: "${gameName}"
Playstyle: "${playstyle}"
Device Telemetry: ${JSON.stringify({
          deviceModelHint: telemetry.deviceModelHint,
          ramGb: telemetry.ramGb,
          cpuCores: telemetry.cpuCores,
          estimatedRefreshHz: telemetry.estimatedRefreshHz,
          gpuRenderer: telemetry.gpuRenderer,
        })}

Return tuned mode (eco, balance, rise, or diablo), targetFps (60, 90, 120, or 144), fanMode (smart or max), touchResponse (standard, fast, or ultra_960hz), crosshairStyle (dot, cross, circle_dot, chevron, or off), huntFilter (none, night_vision, edge_clarity, high_contrast, or anti_flash), and Free Fire / Shooter sensitivity scale (0-200) plus 2 short tactical coaching notes.`,
        config: {
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              performanceMode: {type: Type.STRING},
              targetFps: {type: Type.NUMBER},
              fanMode: {type: Type.STRING},
              touchResponse: {type: Type.STRING},
              crosshairStyle: {type: Type.STRING},
              huntFilter: {type: Type.STRING},
              sensitivityGeneral: {type: Type.NUMBER},
              sensitivityRedDot: {type: Type.NUMBER},
              sensitivity2x: {type: Type.NUMBER},
              sensitivity4x: {type: Type.NUMBER},
              rationale: {type: Type.STRING},
            },
            required: [
              'performanceMode',
              'targetFps',
              'fanMode',
              'touchResponse',
              'crosshairStyle',
              'huntFilter',
              'sensitivityGeneral',
              'sensitivityRedDot',
              'sensitivity2x',
              'sensitivity4x',
              'rationale',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as Record<string, unknown>;
      const usedTokens = extractUsedTokens(response, 360);
      recordTokenUsage(usedTokens);

      const clampSens = (v: unknown, fallback: number) => {
        const n = Number(v);
        return Number.isFinite(n) ? Math.min(200, Math.max(40, Math.round(n))) : fallback;
      };
      const rawMode = String(parsed.performanceMode ?? 'rise').toLowerCase();
      const performanceMode: GameSpaceState['performanceMode'] =
        rawMode === 'eco' || rawMode === 'balance' || rawMode === 'diablo' ? rawMode : 'rise';
      const rawFps = Number(parsed.targetFps ?? 120);
      const targetFps: GameSpaceState['targetFps'] =
        rawFps >= 144 ? 144 : rawFps >= 120 ? 120 : rawFps >= 90 ? 90 : 60;
      const fanMode: GameSpaceState['fanMode'] =
        String(parsed.fanMode ?? 'smart').toLowerCase() === 'max' ? 'max' : 'smart';
      const rawTouch = String(parsed.touchResponse ?? 'ultra_960hz').toLowerCase();
      const touchResponse: GameSpaceState['touchResponse'] =
        rawTouch === 'standard' || rawTouch === 'fast' ? rawTouch : 'ultra_960hz';
      const rawCross = String(parsed.crosshairStyle ?? 'circle_dot').toLowerCase();
      const crosshairStyle: GameSpaceState['crosshairStyle'] =
        rawCross === 'dot' ||
        rawCross === 'cross' ||
        rawCross === 'chevron' ||
        rawCross === 'off'
          ? rawCross
          : 'circle_dot';
      const rawHunt = String(parsed.huntFilter ?? 'none').toLowerCase();
      const huntFilter: GameSpaceState['huntFilter'] =
        rawHunt === 'night_vision' ||
        rawHunt === 'edge_clarity' ||
        rawHunt === 'high_contrast' ||
        rawHunt === 'anti_flash'
          ? rawHunt
          : 'none';

      res.json({
        recommendation: {
          performanceMode,
          targetFps,
          fanMode,
          fanRpm: fanMode === 'max' ? 23000 : 19500,
          touchResponse,
          crosshairStyle,
          huntFilter,
          sensitivityGeneral: clampSens(parsed.sensitivityGeneral, 185),
          sensitivityRedDot: clampSens(parsed.sensitivityRedDot, 175),
          sensitivity2x: clampSens(parsed.sensitivity2x, 150),
          sensitivity4x: clampSens(parsed.sensitivity4x, 132),
          rationale: String(parsed.rationale ?? `Tuned Game Space profile for ${gameName}.`),
        },
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Game Space AI optimization failed.';
      res.status(500).json({error: errMsg});
    }
  });

  // YouTube Agents Team Management & Autonomous Posting Queue
  app.patch('/api/prime/youtube/agents/:id', (req, res) => {
    const patch = (req.body ?? {}) as Partial<YouTubeAgentConfig>;
    res.json(updateYouTubeAgent(req.params.id, patch));
  });

  app.patch('/api/prime/youtube/agent-settings', (req, res) => {
    const patch = (req.body ?? {}) as Partial<YouTubeAgentSettings>;
    res.json(updateYouTubeAgentSettings(patch));
  });

  app.post('/api/prime/youtube/queue', (req, res) => {
    const rawItems = Array.isArray(req.body?.items)
      ? req.body.items
      : req.body?.topic
        ? [req.body]
        : [];
    if (rawItems.length === 0) {
      res.status(400).json({error: 'No YouTube queue items provided.'});
      return;
    }
    const replace = Boolean(req.body?.replace);
    const now = Date.now();
    const jobs: YouTubeAgentPostJob[] = rawItems.map((it: Record<string, unknown>, idx: number) => {
      const format: VideoFormat = it.format === '16:9' ? '16:9' : '9:16';
      const rawTheme = String(it.theme ?? 'gold');
      const theme: YouTubeVideoTheme =
        rawTheme === 'cyan' || rawTheme === 'emerald' || rawTheme === 'crimson' ? rawTheme : 'gold';
      const rawPrivacy = String(it.privacyStatus ?? 'private');
      const privacyStatus: YouTubeAgentPostJob['privacyStatus'] =
        rawPrivacy === 'public' || rawPrivacy === 'unlisted' ? rawPrivacy : 'private';
      const topic = String(it.topic ?? 'Untitled Video').trim();
      const title = String(it.title ?? topic).trim().slice(0, 95);
      const hook = String(it.hook ?? topic.slice(0, 28).toUpperCase()).trim();
      const scheduledForMs =
        typeof it.scheduledForMs === 'number' && Number.isFinite(it.scheduledForMs)
          ? it.scheduledForMs
          : now + (idx + 1) * 4 * 60 * 60_000;
      const stage: YouTubePostStage =
        it.stage === 'script_ready' ||
        it.stage === 'rendered' ||
        it.stage === 'audited' ||
        it.stage === 'scheduled' ||
        it.stage === 'published' ||
        it.stage === 'failed'
          ? it.stage
          : 'queued';

      return {
        id: `ytjob_${now}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        topic,
        title,
        hook,
        format,
        theme,
        privacyStatus,
        scheduledForMs,
        stage,
        autoPost: it.autoPost !== false,
        project: it.project as VideoProject | undefined,
        updatedAtMs: now,
      };
    });

    res.json(addYouTubePostJobs(jobs, replace));
  });

  app.patch('/api/prime/youtube/queue/:id', (req, res) => {
    const patch = (req.body ?? {}) as Partial<YouTubeAgentPostJob>;
    res.json(updateYouTubePostJob(req.params.id, patch));
  });

  app.delete('/api/prime/youtube/queue/:id', (req, res) => {
    res.json(deleteYouTubePostJob(req.params.id));
  });

  app.post('/api/prime/youtube/agents/scout', async (req, res) => {
    const niche = String(req.body?.niche ?? '').trim() || 'AI Productivity & Tech';
    const count = Math.min(8, Math.max(2, Number(req.body?.count ?? 4) || 4));
    const format: VideoFormat = req.body?.format === '16:9' ? '16:9' : '9:16';

    try {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `You are PRIME's YouTube Trend & Topic Scout Agent. Generate ${count} high-CTR ${format === '9:16' ? 'YouTube Shorts' : 'YouTube HD'} video concepts for the niche "${niche}".
Return JSON with items array of { topic, title, hook } where hook is 2 to 4 bold uppercase words for the cover thumbnail.`,
        config: {
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    topic: {type: Type.STRING},
                    title: {type: Type.STRING},
                    hook: {type: Type.STRING},
                  },
                  required: ['topic', 'title', 'hook'],
                },
              },
            },
            required: ['items'],
          },
        },
      });
      const tokensUsed = extractUsedTokens(response, 360);
      recordTokenUsage(tokensUsed);
      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        items?: Array<{topic?: string; title?: string; hook?: string}>;
      };
      res.json({items: (parsed.items ?? []).slice(0, count)});
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'AI Trend Scout could not run.',
      });
    }
  });

  // Live Preview App Version & Direct Android APK metadata
  app.get('/api/prime/app-info', (_req, res) => {
    const apkPath = path.resolve(process.cwd(), '.build-outputs/app-debug.apk');
    const apkStats = fs.existsSync(apkPath) ? fs.statSync(apkPath) : null;
    res.json({
      appName: 'PRIME AI',
      previewVersion: '2.5.0',
      features: [
        'Companion & Expressive Voice Studio',
        'RedMagic Game Space Console',
        'Free Unlimited YouTube Agents & Auto-Video Studio',
        'AI Workforce & Vault Custom Tags',
      ],
      apkAvailable: Boolean(apkStats),
      apkBytes: apkStats?.size ?? 0,
      apkUpdatedAtMs: apkStats?.mtimeMs ?? null,
      apkPath: '/api/prime/android-apk',
    });
  });

  // Serve compiled Android APK when available in .build-outputs/
  app.get('/api/prime/android-apk', (_req, res) => {
    const apkPath = path.resolve(process.cwd(), '.build-outputs/app-debug.apk');
    if (!fs.existsSync(apkPath)) {
      res.status(404).json({error: 'Android APK build output is not available yet.'});
      return;
    }
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.download(apkPath, 'PRIME-android-debug.apk');
  });

  // Serve Vite middleware in dev or built dist/ in production
  const distDir = path.resolve(process.cwd(), 'dist');
  const useProdStatic = process.env.NODE_ENV === 'production' && fs.existsSync(distDir);

  if (!useProdStatic) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PRIME_PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`PRIME server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start PRIME server:', err);
  process.exit(1);
});

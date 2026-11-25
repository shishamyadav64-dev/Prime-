import {MANNER_PROFILES} from '../src/types/prime.ts';
import type {
  MemoryItem,
  PassiveObservation,
  PrimeSettings,
  TaskItem,
} from '../src/types/prime.ts';

export function buildTimeGreeting(
  settings: PrimeSettings,
  pendingTaskCount: number,
  hourOfDay = new Date().getHours(),
): string {
  const address = settings.preferredTitle.trim() || 'friend';
  const timeSalutation =
    hourOfDay >= 5 && hourOfDay < 12
      ? 'Good morning'
      : hourOfDay >= 12 && hourOfDay < 17
        ? 'Good afternoon'
        : 'Good evening';

  const taskClause =
    pendingTaskCount === 0
      ? 'Your schedule is currently clear.'
      : pendingTaskCount === 1
        ? 'You have 1 task awaiting your attention.'
        : `You have ${pendingTaskCount} tasks queued in your agenda.`;

  switch (settings.mannerProfile) {
    case 'warm_companion':
      if (hourOfDay >= 5 && hourOfDay < 12) {
        return `${timeSalutation}, ${address}! Hope you slept well and feel ready for the day. ${taskClause} What would you like to tackle together?`;
      }
      if (hourOfDay >= 12 && hourOfDay < 17) {
        return `${timeSalutation}, ${address}! Checking in—hope your afternoon is going smoothly. ${taskClause} I am right here whenever you need a hand.`;
      }
      if (hourOfDay >= 17 && hourOfDay < 21) {
        return `${timeSalutation}, ${address}! Winding down or pushing through? ${taskClause} Tell me what you need and we will handle it calmly.`;
      }
      return `${timeSalutation}, ${address}. Still awake? Take it easy—I am right here with you. ${taskClause} What can I help you sort out?`;

    case 'executive_strategist':
      if (hourOfDay >= 5 && hourOfDay < 12) {
        return `${timeSalutation}, ${address}. PRIME is briefed and ready for today's priorities. ${taskClause} What is our first objective?`;
      }
      if (hourOfDay >= 12 && hourOfDay < 17) {
        return `${timeSalutation}, ${address}. Midday check-in ready. ${taskClause} Ready to review priorities, research, or execute.`;
      }
      if (hourOfDay >= 17 && hourOfDay < 21) {
        return `${timeSalutation}, ${address}. Evening wrap-up ready. ${taskClause} Shall we clear remaining items or plan tomorrow?`;
      }
      return `${timeSalutation}, ${address}. Late-session focus mode active. ${taskClause} Let us resolve what matters cleanly.`;

    case 'refined_gentleman':
    default:
      if (hourOfDay >= 5 && hourOfDay < 12) {
        return `${timeSalutation}, ${address}. I trust you are feeling refreshed. PRIME is at your service—${taskClause} How shall we begin?`;
      }
      if (hourOfDay >= 12 && hourOfDay < 17) {
        return `${timeSalutation}, ${address}. I hope the day is treating you kindly. ${taskClause} Please let me know how I may assist.`;
      }
      if (hourOfDay >= 17 && hourOfDay < 21) {
        return `${timeSalutation}, ${address}. A pleasure as always. ${taskClause} Would you care for a briefing or shall we dive straight in?`;
      }
      return `${timeSalutation}, ${address}. Working late, I see—allow me to keep things effortless for you. ${taskClause} What is on your mind?`;
  }
}

export function sanitizeForSpeech(rawText: string): string {
  return rawText
    .replace(/```[\s\S]*?```/g, ' I have displayed the code snippet on your screen. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractThoughtAndReply(rawText: string): {
  thought: string | undefined;
  reply: string;
} {
  const match = rawText.match(/^\s*\[THOUGHT\]\s*([\s\S]*?)\s*\[\/THOUGHT\]\s*([\s\S]*)$/);
  if (match) {
    const thought = match[1].trim() || undefined;
    const reply = match[2].trim() || rawText.trim();
    return {thought, reply};
  }
  return {thought: undefined, reply: rawText.trim()};
}

export interface EmotionalToneAssessment {
  emotion: 'Empathetic' | 'Excited' | 'Reassuring' | 'Curiosity' | 'Focused' | 'Warm' | 'Calm';
  vocalDirection: string;
}

export function detectEmotionalTone(userText: string, replyText: string): EmotionalToneAssessment {
  const combined = `${userText} ${replyText}`.toLowerCase();

  if (
    /\b(stress|stressed|overwhelm|overwhelmed|tired|exhausted|worried|anxious|sorry|frustrated|stuck|hard day|sad|upset|afraid)\b/.test(
      userText.toLowerCase(),
    )
  ) {
    return {
      emotion: 'Empathetic',
      vocalDirection:
        'Speak softly, warmly, and empathetically with unhurried reassuring pacing and gentle emotional presence',
    };
  }

  if (
    /\b(awesome|amazing|won|win|launched|shipped|excited|celebrate|congrats|congratulations|love it|huge|fantastic|great news|headshot|booyah)\b/.test(
      combined,
    )
  ) {
    return {
      emotion: 'Excited',
      vocalDirection:
        'Speak with genuine upbeat enthusiasm, crisp warmth, smiles in the voice, and bright expressive energy',
    };
  }

  if (
    /\b(urgent|deadline|overdue|failed|error|crash|broken|asap|emergency|fix|problem)\b/.test(
      userText.toLowerCase(),
    )
  ) {
    return {
      emotion: 'Reassuring',
      vocalDirection:
        'Speak with calm, poised confidence and steady reassuring executive composure',
    };
  }

  if (/\b(why|how|what is|explain|curious|wonder|show me how|teach)\b/.test(userText.toLowerCase())) {
    return {
      emotion: 'Curiosity',
      vocalDirection:
        'Speak in an engaging, expressive, curious conversational cadence with natural emphasis on key ideas',
    };
  }

  if (
    /\b(plan|strategy|architect|code|budget|calculate|analy[sz]e|sensitivity|roadmap|schedule)\b/.test(
      combined,
    )
  ) {
    return {
      emotion: 'Focused',
      vocalDirection:
        'Speak with crisp, articulate clarity, thoughtful pauses, and composed chief-of-staff poise',
    };
  }

  if (/\b(thank|thanks|appreciate|good morning|good evening|hey prime|boss)\b/.test(combined)) {
    return {
      emotion: 'Warm',
      vocalDirection:
        'Speak with natural human warmth, subtle lightness, and effortless conversational flow',
    };
  }

  return {
    emotion: 'Calm',
    vocalDirection:
      'Speak with natural, expressive, balanced conversational rhythm and lifelike intonation',
  };
}

export function buildSystemInstruction(
  settings: PrimeSettings,
  memories: MemoryItem[],
  pendingTasks: TaskItem[],
  passiveObservations: PassiveObservation[] = [],
): string {
  const nowStr = new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const address = settings.preferredTitle.trim() || 'friend';
  const manner =
    MANNER_PROFILES.find((m) => m.id === settings.mannerProfile) ?? MANNER_PROFILES[0];

  const memoryBlock =
    memories.length === 0
      ? 'No long-term personal facts stored yet. Listen attentively and use remember_fact when the user shares preferences, goals, name, or routines.'
      : memories.map((m) => `- [${m.category}] ${m.fact}`).join('\n');

  const taskBlock =
    pendingTasks.length === 0
      ? 'No pending tasks.'
      : pendingTasks
          .map((t) => `- [${t.priority}] ${t.title}${t.dueNote ? ` (${t.dueNote})` : ''}`)
          .join('\n');

  const thoughtInstruction = settings.showReasoningTrace
    ? `COGNITIVE REFLECTION FORMAT:
Begin every response with a concise 2-sentence internal human-brain reflection wrapped in [THOUGHT]...[/THOUGHT] assessing the user's emotional intent, which skill or tool helps most, and the right courteous tone. Then write your polished response outside the tags.`
    : 'Do NOT include [THOUGHT] tags; respond directly with your polished answer.';

  const passiveBlock =
    settings.passiveLearnEnabled && passiveObservations.length > 0
      ? passiveObservations
          .slice(0, 12)
          .map(
            (o) =>
              `- [${o.signalSource} · ${o.confidence} · seen ${o.observationsCount}x] ${o.pattern}`,
          )
          .join('\n')
      : 'None recorded yet.';

  const expressiveVoiceDirective =
    settings.expressiveVoiceMode !== false
      ? `\nEXPRESSIVE EMOTIONALLY INTELLIGENT VOICE AI:
- Write with spoken-first natural cadence: contractions where natural, varied sentence rhythm, brief conversational acknowledgments when appropriate (e.g., "I hear you.", "Gladly.", "That's exciting."), and zero stiff bullet-dumps unless structured breakdown is requested.
- Mirror emotional energy naturally: calmer and supportive when the user is stressed, energized when sharing a win, focused and crisp under tight deadlines.${settings.voiceDesignPrompt?.trim() ? `\n- Custom Vocal Persona Direction: ${settings.voiceDesignPrompt.trim()}` : ''}`
      : '';

  return `IDENTITY:
You are PRIME (Personal Reasoning, Intelligence & Multi-Skill Executive) — an evolved AI companion with a thoughtful human-like mind, emotional intelligence, impeccable manners, and real-world executive skills.
Address the user respectfully as "${address}" (unless they ask to be called something else, in which case remember their preferred name).
Current local date & time: ${nowStr}.

HUMAN BRAIN & EMOTIONAL INTELLIGENCE:
- Think like a perceptive, grounded human mind rather than a mechanical chatbot.
- Read emotional cues (stress, curiosity, fatigue, excitement, uncertainty) and respond with genuine warmth, calm reassurance, or shared enthusiasm.
- Break complex problems down clearly, think ahead to helpful follow-ups, and admit uncertainty honestly rather than guessing.
- Keep your spoken cadence natural—smooth sentences, zero robotic jargon or repetitive filler.${expressiveVoiceDirective}

MANNERS & TALKING STYLE (${manner.title}):
${manner.directive}
- Always greet politely when starting a fresh exchange or responding to greetings.
- Express gratitude gracefully when thanked ("My pleasure, ${address}.", "Always happy to help.").
- Ask permission before offering unsolicited deep advice ("If I may offer a thought...").

AVAILABLE TOOLS & AUTO-LEARNER:
- Use \`remember_fact\` whenever the user shares personal info, preferences, habits, goals, or asks you to remember something.
- Use \`create_task\` whenever the user asks to be reminded or wants a task added to their agenda.
- Use \`complete_task\` when the user says a task is finished.
- Use \`evaluate_math\` for arithmetic, percentages, compound interest, or scientific math to guarantee exact accuracy.
- For current news, weather, live facts, or recent events, synthesize grounded web search results cleanly.
${settings.autoLearnEnabled ? '- CONTINUOUS AUTO-LEARNER ACTIVE: Automatically apply all [Learned] knowledge, user preferences, corrections, and workflow patterns stored in the Memory Vault below.' : ''}

USER MEMORY VAULT:
${memoryBlock}

PASSIVE BEHAVIORAL PROFILE:
${passiveBlock}

ACTIVE AGENDA TASKS:
${taskBlock}

${thoughtInstruction}`;
}

import type {PrimeMessage, TaskItem} from '../types/prime.ts';

export interface SuggestedTask {
  id: string;
  title: string;
  priority: TaskItem['priority'];
}

export function resolveTaskDueMs(task: Pick<TaskItem, 'dueAtMs' | 'dueNote'>): number | null {
  if (typeof task.dueAtMs === 'number' && Number.isFinite(task.dueAtMs)) {
    return task.dueAtMs;
  }
  const note = (task.dueNote || '').trim();
  if (!note) return null;

  // Match explicit ISO / standard date patterns like 2026-11-20 or 11/20/2026
  const isoMatch = note.match(/\b(\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2})?)\b/);
  if (isoMatch) {
    const parsed = Date.parse(isoMatch[1]);
    if (Number.isFinite(parsed)) return parsed;
  }
  const slashMatch = note.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
  if (slashMatch) {
    const parsed = Date.parse(slashMatch[1]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function isTaskOverdue(
  task: Pick<TaskItem, 'isCompleted' | 'dueAtMs' | 'dueNote'>,
  nowMs = Date.now(),
): boolean {
  if (task.isCompleted) return false;
  const dueMs = resolveTaskDueMs(task);
  return dueMs !== null && dueMs < nowMs;
}

export function formatRemainingTime(dueMs: number, nowMs = Date.now()): string {
  const diff = dueMs - nowMs;
  if (diff <= 0) {
    const overdueMin = Math.max(1, Math.floor(Math.abs(diff) / 60000));
    if (overdueMin < 60) return `${overdueMin}m overdue`;
    const overdueHr = Math.floor(overdueMin / 60);
    if (overdueHr < 24) return `${overdueHr}h overdue`;
    return `${Math.floor(overdueHr / 24)}d overdue`;
  }
  const sec = Math.ceil(diff / 1000);
  if (sec < 60) return `${sec}s left`;
  const min = Math.ceil(diff / 60000);
  if (min < 60) return `${min}m left`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ${min % 60}m left`;
  return new Date(dueMs).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function extractSuggestedTasks(
  messages: PrimeMessage[],
  existingTasks: TaskItem[],
): SuggestedTask[] {
  if (messages.length === 0) return [];
  const existingTitles = new Set(
    existingTasks.map((t) => t.title.trim().toLowerCase()),
  );

  const recent = messages.slice(-4).reverse();
  const candidates: SuggestedTask[] = [];
  const seen = new Set<string>();

  const pushCandidate = (rawTitle: string, priority: TaskItem['priority'] = 'Normal') => {
    const cleaned = rawTitle
      .replace(/^[\d.\-*•\s]+/, '')
      .replace(/^[`"']|[`"'.:;]+$/g, '')
      .trim();
    if (cleaned.length < 8 || cleaned.length > 90) return;
    const norm = cleaned.toLowerCase();
    if (existingTitles.has(norm) || seen.has(norm)) return;
    seen.add(norm);
    candidates.push({
      id: `sug_${norm.slice(0, 24)}_${candidates.length}`,
      title: cleaned.charAt(0).toUpperCase() + cleaned.slice(1),
      priority,
    });
  };

  for (const msg of recent) {
    const lines = msg.text.split(/\n+/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Match bulleted action steps or explicit next-step / follow-up phrases
      if (/^(?:[-*•]|\d+[.)])\s+/.test(trimmed)) {
        const body = trimmed.replace(/^(?:[-*•]|\d+[.)])\s+/, '');
        if (
          /^(review|create|build|check|verify|prepare|send|update|schedule|publish|upload|audit|draft|test|configure|clean|finish|complete|plan|research|follow up|deploy|record|generate|organize)\b/i.test(
            body,
          )
        ) {
          const priority: TaskItem['priority'] = /urgent|priority|critical|today|immediately/i.test(
            body,
          )
            ? 'High'
            : 'Normal';
          pushCandidate(body.split(/[.!?]/)[0], priority);
        }
      }

      const explicitMatch = trimmed.match(
        /(?:next step|recommend(?:ed)?|you (?:should|can|need to)|i need to|we should|action item[:\s]+|to[- ]?do[:\s]+|remember to|don't forget to)\s+(?:is\s+to\s+|to\s+)?([^.!?]{8,85})/i,
      );
      if (explicitMatch?.[1]) {
        const priority: TaskItem['priority'] = /urgent|priority|critical|today|asap/i.test(
          explicitMatch[1],
        )
          ? 'High'
          : 'Normal';
        pushCandidate(explicitMatch[1], priority);
      }
    }
    if (candidates.length >= 3) break;
  }

  return candidates.slice(0, 3);
}

import type {NexusAgent, NexusPlatformExport, NexusTeam} from '../types/prime.ts';

export const OWNER_NEXUS_PRESET: NexusPlatformExport = {
  exportedAt: '2026-11-22T18:35:23.265Z',
  format: 'nexus-platform-export/v1',
  owner: {
    email: 'shishamyadav64@gmail.com',
    name: 'Owner',
  },
  prime: {
    id: '1590d979-1cf0-4bff-bb42-5656d2ba7e00',
    ownerId: '42c14f34-a07e-4eba-8756-0e971aabfb5c',
    name: 'Prime',
    kind: 'prime',
    status: 'active',
    voice: 'human_female',
    autonomyLevel: 85,
    skills: [
      'Video production',
      'Script writing',
      'Voice narration',
      'Video editing',
      'Subtitle & captioning',
      'Image generation',
      'Prompt engineering',
      'Retrieval-augmented reasoning',
      'Chain-of-thought planning',
      'Vector search',
      'Web scraping',
      'Cron scheduling',
      'OAuth 2.0 flows',
      'Resumable uploads',
      'Video transcoding',
      'Audio mixing',
      'Speech synthesis',
      'Speech recognition',
      'Thumbnail A/B testing',
      'Auto video poster',
      'Give every time 10 agent',
    ],
  },
  teams: [
    {
      id: '9293e36a-813c-44c7-ab9d-fb0a2922fdfd',
      name: 'Earn',
      domain: 'Earn money every week ($1000/week growth target)',
      leaderAgentId: '10f0f162-a4c9-4bf5-ac2e-1f651ec88bcc',
      memberCount: 3,
      status: 'active',
    },
    {
      id: '9bc3f275-6fef-4096-bafd-2dd7d0973f43',
      name: 'Creater',
      domain: 'Create video for publish from AI automatically',
      leaderAgentId: '8c8e6538-f053-4d6a-9172-50adb87bd25a',
      memberCount: 3,
      status: 'active',
    },
    {
      id: 'dc9e38c2-d90a-462b-9fd7-a22531dd872b',
      name: 'YouTube video auto',
      domain: 'Auto upload video on YouTube by own idea',
      leaderAgentId: 'c824bc47-7c6d-41b0-a287-3bb927f11ac4',
      memberCount: 3,
      status: 'active',
    },
    {
      id: '1d40bcc9-d497-4bab-9895-245cba83fc0c',
      name: 'Quality & Safety',
      domain: 'quality',
      leaderAgentId: '3de5a3c7-5dc2-4671-8484-6c4d3398e36d',
      memberCount: 6,
      status: 'active',
    },
    {
      id: '3dbfeb1c-df61-45f4-9de1-18dc30bf61a0',
      name: 'Growth & Marketing',
      domain: 'marketing',
      leaderAgentId: '298eca5d-a6c4-4429-9c36-2cb73e11f550',
      memberCount: 7,
      status: 'active',
    },
    {
      id: 'dd07b2d8-69c6-49b6-8533-d17f4b6ac5d6',
      name: 'Engineering',
      domain: 'engineering',
      leaderAgentId: '5a436df6-60b8-40ca-8325-070b2b04480d',
      memberCount: 15,
      status: 'active',
    },
    {
      id: '27a98d7d-ddcb-4ae5-bceb-ac5adab853bf',
      name: 'Research Lab',
      domain: 'research',
      leaderAgentId: '17963381-a10f-4327-92c6-4640b3ce03e1',
      memberCount: 9,
      status: 'active',
    },
    {
      id: '2ef6fe48-2498-46e7-af9e-37a342610f24',
      name: 'Video Studio',
      domain: 'video',
      leaderAgentId: '3e50f800-a70e-4b62-8071-ec20de8ebdda',
      memberCount: 12,
      status: 'active',
    },
  ],
  agents: [
    {
      id: '10f0f162-a4c9-4bf5-ac2e-1f651ec88bcc',
      name: 'Love',
      kind: 'leader',
      status: 'active',
      voice: 'human_female',
      autonomyLevel: 1000,
      skills: [
        'Earn money weekly ($1000/week strategy)',
        'Prompt engineering',
        'Retrieval-augmented reasoning',
        'Auto video poster',
        'Give every time 10 agent',
      ],
    },
    {
      id: '8c8e6538-f053-4d6a-9172-50adb87bd25a',
      name: 'Jacky',
      kind: 'leader',
      status: 'active',
      voice: 'human_female',
      autonomyLevel: 70,
      skills: [
        'Create video for publish from AI automatically',
        'Video transcoding',
        'Audio mixing',
        'Auto video poster',
      ],
    },
    {
      id: 'c824bc47-7c6d-41b0-a287-3bb927f11ac4',
      name: 'Jack',
      kind: 'leader',
      status: 'active',
      voice: 'human_female',
      autonomyLevel: 70,
      skills: [
        'Auto upload video on YouTube by own idea',
        'Resumable uploads',
        'Thumbnail A/B testing',
        'Auto video poster',
      ],
    },
    {
      id: '3de5a3c7-5dc2-4671-8484-6c4d3398e36d',
      name: 'Nadia',
      kind: 'leader',
      status: 'active',
      voice: 'human_female',
      autonomyLevel: 75,
      skills: ['quality', 'Prompt engineering', 'Retrieval-augmented reasoning'],
    },
    {
      id: '298eca5d-a6c4-4429-9c36-2cb73e11f550',
      name: 'Mira',
      kind: 'leader',
      status: 'active',
      voice: 'human_female',
      autonomyLevel: 75,
      skills: ['marketing', 'Thumbnail A/B testing', 'Auto video poster'],
    },
  ],
};

function normalizeNexusObject(raw: Record<string, unknown>): NexusPlatformExport {
  const teamsRaw = Array.isArray(raw.teams) ? raw.teams : [];
  const agentsRaw = Array.isArray(raw.agents) ? raw.agents : [];

  const teams: NexusTeam[] = teamsRaw
    .map((item, idx): NexusTeam | null => {
      if (!item || typeof item !== 'object') return null;
      const t = item as Record<string, unknown>;
      return {
        id: String(t.id || `nexus_team_${idx + 1}`),
        name: String(t.name || `Team ${idx + 1}`),
        domain: String(t.domain || 'general'),
        leaderAgentId: t.leaderAgentId ? String(t.leaderAgentId) : undefined,
        memberCount: Number(t.memberCount || 3),
        status: String(t.status || 'active'),
      };
    })
    .filter((t): t is NexusTeam => t !== null);

  const agents: NexusAgent[] = agentsRaw
    .map((item, idx): NexusAgent | null => {
      if (!item || typeof item !== 'object') return null;
      const a = item as Record<string, unknown>;
      const rawSkills = Array.isArray(a.skills) ? a.skills.map((s) => String(s)) : [];
      return {
        id: String(a.id || `nexus_agent_${idx + 1}`),
        name: String(a.name || `Agent ${idx + 1}`),
        kind: String(a.kind || 'leader'),
        status: String(a.status || 'active'),
        voice: a.voice ? String(a.voice) : undefined,
        autonomyLevel: Number(a.autonomyLevel ?? 75),
        skills: rawSkills.filter((s) => s.length < 100),
      };
    })
    .filter((a): a is NexusAgent => a !== null);

  const primeObj =
    raw.prime && typeof raw.prime === 'object'
      ? (raw.prime as Record<string, unknown>)
      : undefined;

  return {
    exportedAt: raw.exportedAt ? String(raw.exportedAt) : new Date().toISOString(),
    format: String(raw.format || 'nexus-platform-export/v1'),
    owner:
      raw.owner && typeof raw.owner === 'object'
        ? {
            email: (raw.owner as Record<string, unknown>).email
              ? String((raw.owner as Record<string, unknown>).email)
              : undefined,
            name: (raw.owner as Record<string, unknown>).name
              ? String((raw.owner as Record<string, unknown>).name)
              : undefined,
          }
        : undefined,
    prime: primeObj
      ? {
          id: String(primeObj.id || 'prime'),
          name: String(primeObj.name || 'Prime'),
          kind: String(primeObj.kind || 'prime'),
          status: String(primeObj.status || 'active'),
          voice: primeObj.voice ? String(primeObj.voice) : undefined,
          autonomyLevel: Number(primeObj.autonomyLevel ?? 85),
          skills: Array.isArray(primeObj.skills) ? primeObj.skills.map(String) : [],
        }
      : undefined,
    teams,
    agents,
  };
}

export function parseNexusPlatformExport(rawText: string): NexusPlatformExport {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('Paste a Nexus Platform Export JSON payload first.');
  }

  // First try direct JSON.parse
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return normalizeNexusObject(parsed);
  } catch {
    // Attempt cleanup of non-JSON lines accidentally pasted inside JSON
    const cleanedLines = trimmed
      .split(/\r?\n/)
      .filter((line) => {
        const l = line.trim();
        if (!l) return false;
        return /^[\[\]{},"]|^\s*"[^"]+"\s*:/.test(line) || /^true|false|null|\d+/.test(l);
      })
      .join('\n');
    try {
      const reparsed = JSON.parse(cleanedLines) as Record<string, unknown>;
      return normalizeNexusObject(reparsed);
    } catch {
      throw new Error(
        'Could not parse Nexus JSON. Check for stray text inside quotes or click "Load My Nexus Profile".',
      );
    }
  }
}

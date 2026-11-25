import type {MorningBriefingEmail, MorningBriefingEvent} from '../types/prime.ts';

interface GmailListResponse {
  messages?: Array<{id: string}>;
  error?: {message?: string};
}

interface GmailMessageResponse {
  id: string;
  snippet?: string;
  payload?: {
    headers?: Array<{name: string; value: string}>;
  };
}

interface CalendarEventsResponse {
  items?: Array<{
    id: string;
    summary?: string;
    location?: string;
    start?: {dateTime?: string; date?: string};
  }>;
  error?: {message?: string};
}

function readHeader(
  headers: Array<{name: string; value: string}> | undefined,
  name: string,
): string {
  if (!headers) return '';
  const match = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return match?.value ?? '';
}

export async function fetchRecentGmailSummary(
  accessToken: string,
  maxResults = 6,
): Promise<MorningBriefingEmail[]> {
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent('newer_than:7d')}`,
    {
      headers: {Authorization: `Bearer ${accessToken}`},
    },
  );
  const listData = (await listRes.json()) as GmailListResponse;
  if (!listRes.ok) {
    throw new Error(listData.error?.message || 'Unable to read Gmail messages.');
  }

  const ids = (listData.messages ?? []).slice(0, maxResults);
  if (ids.length === 0) return [];

  const details = await Promise.all(
    ids.map(async (item) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        {
          headers: {Authorization: `Bearer ${accessToken}`},
        },
      );
      if (!msgRes.ok) return null;
      const msg = (await msgRes.json()) as GmailMessageResponse;
      const headers = msg.payload?.headers;
      return {
        id: msg.id,
        from: readHeader(headers, 'From') || 'Unknown sender',
        subject: readHeader(headers, 'Subject') || '(No subject)',
        snippet: (msg.snippet ?? '').trim(),
        date: readHeader(headers, 'Date'),
      } satisfies MorningBriefingEmail;
    }),
  );

  return details.filter((item): item is MorningBriefingEmail => item !== null);
}

export async function fetchUpcomingCalendarEvents(
  accessToken: string,
  maxResults = 8,
): Promise<MorningBriefingEvent[]> {
  const now = new Date();
  const inTwoDays = new Date(now.getTime() + 48 * 60 * 60_000);
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: inTwoDays.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(maxResults),
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    {
      headers: {Authorization: `Bearer ${accessToken}`},
    },
  );
  const data = (await res.json()) as CalendarEventsResponse;
  if (!res.ok) {
    throw new Error(data.error?.message || 'Unable to read Google Calendar events.');
  }

  return (data.items ?? []).map((ev) => ({
    id: ev.id,
    summary: ev.summary || 'Untitled event',
    start: ev.start?.dateTime || ev.start?.date || '',
    location: ev.location,
  }));
}

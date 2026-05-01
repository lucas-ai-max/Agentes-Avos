/**
 * Cliente Google Calendar via OAuth refresh token (usado pelo agente Sessão).
 * O fluxo de obtenção do refresh token é feito uma vez via `npm run google:auth`.
 */
import { google, calendar_v3 } from 'googleapis';

let cachedClient: calendar_v3.Calendar | null = null;

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:4000/oauth2callback';

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET ausentes no .env');
  }
  if (!refreshToken) {
    throw new Error('GOOGLE_REFRESH_TOKEN ausente. Rode: npm run google:auth');
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

export function getCalendar(): calendar_v3.Calendar {
  if (cachedClient) return cachedClient;
  cachedClient = google.calendar({ version: 'v3', auth: getOAuth2Client() });
  return cachedClient;
}

export interface FreeSlot {
  start: string;
  end: string;
  label: string;
}

export async function listFreeSlots(opts: {
  from: Date;
  to: Date;
  limit?: number;
  preferPeriod?: 'manha' | 'tarde' | 'qualquer';
}): Promise<FreeSlot[]> {
  const cal = getCalendar();
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? 'primary';
  const timezone = process.env.GOOGLE_CALENDAR_TIMEZONE ?? 'America/Sao_Paulo';
  const horarioInicio = Number(process.env.SESSAO_HORARIO_INICIO ?? 10);
  const horarioFim = Number(process.env.SESSAO_HORARIO_FIM ?? 19);
  const duracaoMin = Number(process.env.SESSAO_DURACAO_MIN ?? 35);

  const fb = await cal.freebusy.query({
    requestBody: {
      timeMin: opts.from.toISOString(),
      timeMax: opts.to.toISOString(),
      timeZone: timezone,
      items: [{ id: calendarId }],
    },
  });

  const busy = (fb.data.calendars?.[calendarId]?.busy ?? []).map((b) => ({
    start: new Date(b.start!).getTime(),
    end: new Date(b.end!).getTime(),
  }));

  const slots: FreeSlot[] = [];
  const limit = opts.limit ?? 6;
  const slotMs = duracaoMin * 60_000;

  const cursor = new Date(opts.from.getTime());
  cursor.setSeconds(0, 0);
  const m = cursor.getMinutes();
  if (m === 0 || m === 30) {
    /* ok */
  } else if (m < 30) {
    cursor.setMinutes(30);
  } else {
    cursor.setMinutes(0);
    cursor.setHours(cursor.getHours() + 1);
  }

  while (cursor.getTime() < opts.to.getTime() && slots.length < limit) {
    const day = cursor.getDay();
    const hour = cursor.getHours();
    const slotStart = cursor.getTime();
    const slotEnd = slotStart + slotMs;

    const dentroJanela =
      day >= 1 &&
      day <= 5 &&
      hour >= horarioInicio &&
      hour < horarioFim &&
      new Date(slotEnd).getHours() <= horarioFim;

    const periodoOk =
      opts.preferPeriod === 'manha'
        ? hour < 12
        : opts.preferPeriod === 'tarde'
          ? hour >= 12
          : true;

    if (dentroJanela && periodoOk) {
      const collide = busy.some((b) => slotStart < b.end && slotEnd > b.start);
      if (!collide) {
        slots.push({
          start: new Date(slotStart).toISOString(),
          end: new Date(slotEnd).toISOString(),
          label: formatLabel(new Date(slotStart), timezone),
        });
      }
    }
    cursor.setMinutes(cursor.getMinutes() + 30);
  }

  return slots;
}

function formatLabel(d: Date, tz: string): string {
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60_000);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
    hour12: false,
  }).format(d);
  if (sameDay) return `Hoje ${time}`;
  if (isTomorrow) return `Amanha ${time}`;
  const date = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: tz,
  }).format(d);
  return `${date} ${time}`;
}

export interface CreatedEvent {
  id: string;
  htmlLink: string;
  meetLink: string | null;
  start: string;
  end: string;
}

export async function createEvent(opts: {
  startISO: string;
  endISO?: string;
  summary: string;
  description?: string;
  attendeeEmail: string;
  attendeeName?: string;
}): Promise<CreatedEvent> {
  const cal = getCalendar();
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? 'primary';
  const timezone = process.env.GOOGLE_CALENDAR_TIMEZONE ?? 'America/Sao_Paulo';
  const duracaoMin = Number(process.env.SESSAO_DURACAO_MIN ?? 35);

  const start = new Date(opts.startISO);
  const end = opts.endISO ? new Date(opts.endISO) : new Date(start.getTime() + duracaoMin * 60_000);

  const res = await cal.events.insert({
    calendarId,
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: {
      summary: opts.summary,
      description: opts.description,
      start: { dateTime: start.toISOString(), timeZone: timezone },
      end: { dateTime: end.toISOString(), timeZone: timezone },
      attendees: [{ email: opts.attendeeEmail, displayName: opts.attendeeName }],
      conferenceData: {
        createRequest: {
          requestId: `sessao-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 15 },
        ],
      },
    },
  });

  const ev = res.data;
  const meet =
    ev.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ?? null;

  return {
    id: ev.id!,
    htmlLink: ev.htmlLink ?? '',
    meetLink: meet,
    start: ev.start?.dateTime ?? start.toISOString(),
    end: ev.end?.dateTime ?? end.toISOString(),
  };
}

export async function deleteEvent(eventId: string): Promise<void> {
  const cal = getCalendar();
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? 'primary';
  await cal.events.delete({ calendarId, eventId, sendUpdates: 'all' });
}

export async function isSlotFree(startISO: string, endISO?: string): Promise<boolean> {
  const cal = getCalendar();
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? 'primary';
  const duracaoMin = Number(process.env.SESSAO_DURACAO_MIN ?? 35);
  const start = new Date(startISO);
  const end = endISO ? new Date(endISO) : new Date(start.getTime() + duracaoMin * 60_000);

  const fb = await cal.freebusy.query({
    requestBody: {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      items: [{ id: calendarId }],
    },
  });
  const busy = fb.data.calendars?.[calendarId]?.busy ?? [];
  return busy.length === 0;
}

const BASE_URL = process.env.CRM_BASE_URL ?? 'https://ffmpeg-lyn-crm-backend.dewwpd.easypanel.host/api';

export interface Contact {
  id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  telefone_2?: string | null;
  empresa?: string | null;
  segmento?: string | null;
  source?: string | null;
  tags?: string[] | null;
  custom_fields?: Record<string, unknown> | null;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  empresa?: string | null;
  segmento?: string | null;
  status: string;
  prioridade?: 'high' | 'medium' | 'low' | null;
  source?: string | null;
  tags?: string[] | null;
  description?: string | null;
  valor_oportunidade?: number | null;
  pipeline_id?: string | null;
  stage_id?: string | null;
  responsavel_id?: string | null;
  company_id: string;
  custom_fields?: Record<string, unknown> | null;
  last_message?: string | null;
  last_message_at?: string | null;
  created_at: string;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  content: string;
  created_by?: string | null;
  created_at: string;
}

export interface FindOrCreateContactInput {
  nome: string;
  company_id: string;
  email?: string;
  telefone?: string;
  telefone_2?: string;
  empresa?: string;
  segmento?: string;
  source?: string;
  tags?: string[];
  custom_fields?: Record<string, unknown>;
}

export interface FindOrCreateContactResult {
  data: Contact;
  created: boolean;
}

export interface CreateLeadInput {
  nome: string;
  company_id: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  segmento?: string;
  status?: string;
  prioridade?: 'high' | 'medium' | 'low';
  source?: string;
  tags?: string[];
  description?: string;
  valor_oportunidade?: number;
  pipeline_id?: string;
  stage_id?: string;
  responsavel_id?: string;
  custom_fields?: Record<string, unknown>;
}

export interface UpdateLeadInput {
  nome?: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  segmento?: string;
  status?: string;
  prioridade?: 'high' | 'medium' | 'low';
  source?: string;
  tags?: string[];
  description?: string;
  valor_oportunidade?: number;
  pipeline_id?: string;
  stage_id?: string;
  responsavel_id?: string;
  custom_fields?: Record<string, unknown>;
  last_message?: string;
  last_message_at?: string;
}

export interface CreateLeadNoteInput {
  content: string;
  created_by?: string;
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const apiKey = process.env.CRM_API_KEY;
  if (apiKey) headers['X-API-Key'] = apiKey;
  return headers;
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers ?? {}) },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`CRM API error ${res.status} on ${options.method} ${url}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export async function findOrCreateContact(
  input: FindOrCreateContactInput,
): Promise<FindOrCreateContactResult> {
  return request<FindOrCreateContactResult>('/contacts/find-or-create', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function createLead(input: CreateLeadInput): Promise<{ data: Lead }> {
  return request<{ data: Lead }>('/leads', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateLead(
  leadId: string,
  input: UpdateLeadInput,
): Promise<{ data: Lead }> {
  return request<{ data: Lead }>(`/leads/${leadId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function addLeadNote(
  leadId: string,
  input: CreateLeadNoteInput,
): Promise<{ data: LeadNote }> {
  return request<{ data: LeadNote }>(`/leads/${leadId}/notes`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getLeadById(leadId: string): Promise<{ data: Lead }> {
  return request<{ data: Lead }>(`/leads/${leadId}`, { method: 'GET' });
}

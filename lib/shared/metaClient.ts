const GRAPH_BASE = 'https://graph.instagram.com/v25.0';

function getAccessToken(): string {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token || token === 'token_de_longa_duracao') {
    throw new Error('INSTAGRAM_ACCESS_TOKEN não configurado no .env');
  }
  return token;
}

export interface InstagramProfile {
  username: string;
  name?: string;
  profile_pic?: string;
  follower_count?: number;
}

export async function getUsernameByIGSID(igsid: string): Promise<InstagramProfile> {
  const token = getAccessToken();
  const url = `${GRAPH_BASE}/${encodeURIComponent(igsid)}?fields=username,name,profile_pic&access_token=${token}`;

  const res = await fetch(url);
  const body = await res.text();

  if (!res.ok) {
    throw new Error(`Meta Graph API ${res.status} (getUsernameByIGSID ${igsid}): ${body}`);
  }

  const data = JSON.parse(body) as InstagramProfile;
  if (!data.username) {
    throw new Error(`Resposta sem username: ${body}`);
  }
  return data;
}

export async function sendInstagramDM(igsid: string, text: string): Promise<void> {
  const token = getAccessToken();
  const url = `${GRAPH_BASE}/me/messages?access_token=${token}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: igsid },
      message: { text },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta Send API ${res.status} (sendInstagramDM ${igsid}): ${body}`);
  }
}

import dotenv from 'dotenv';
import crypto from 'node:crypto';
import { setIgsidCache } from '../lib/socialia/igsidCacheClient.js';
import { closePool } from '../lib/shared/pool.js';

dotenv.config();

const APP_SECRET = process.env.META_APP_SECRET!;
const IGSID = '1559717405585407'; // @lucas.gestoria real
const USERNAME = 'lucas.gestoria';
const RECIPIENT = '17841466533037649'; // @neuronex.ia real

const payload = {
  object: 'instagram',
  entry: [{
    time: Date.now(),
    id: RECIPIENT,
    messaging: [{
      sender: { id: IGSID },
      recipient: { id: RECIPIENT },
      timestamp: Date.now(),
      message: { mid: 'mid_' + Date.now(), text: 'Oi, tô bem sim e voce?' },
    }],
  }],
};

await setIgsidCache(IGSID, USERNAME, 'Lucas Manoel');
const body = JSON.stringify(payload);
const sig = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(body).digest('hex');
const r = await fetch('http://localhost:3001/webhook/instagram', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sig },
  body,
});
console.log('HTTP', r.status, await r.text());
await closePool();

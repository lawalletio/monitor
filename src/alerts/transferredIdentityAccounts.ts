import { WebSocket } from 'ws';

import { HealthLevel } from '@lib/alerts';
import { getCloseMessage, getTagValue, NostrEvent, REQ } from '@lib/events';

type Metrics = {
  totalIdentityTransfers: number;
  nonZeroBalances: number;
};

const INTERVAL_MS = 61000;
const SUBSCRIPTION_NAME = 'transferredIdentityBalances';
const IDENTITY_TRANSFERS = 'identityTransfers';
const dValues: Set<string> = new Set();
const req: REQ = [
  'REQ',
  SUBSCRIPTION_NAME,
  {
    kinds: [31111],
    '#d': [],
  },
];
const changesReq: REQ = [
  'REQ',
  IDENTITY_TRANSFERS,
  {
    kinds: [1112],
    '#t': ['identity-transfer-ok'],
  },
];
let latestTimestamp: number;

async function monitor(): Promise<Metrics> {
  const relayUrl: string = process.env.NOSTR_RELAY ?? '';
  let nonZeroBalances: number = 0;
  req[2]['#d'] = [...dValues.values()];
  const totalIdentityTransfers: number = (req[2]['#d'] ?? []).length;
  let ws: WebSocket;
  try {
    ws = new WebSocket(relayUrl);
  } catch (e) {
    return Promise.reject(e);
  }
  if (latestTimestamp) {
    changesReq[2].since = latestTimestamp;
  }
  ws.on('open', () => {
    ws.send(JSON.stringify(changesReq));
    if (0 < totalIdentityTransfers) {
      ws.send(JSON.stringify(req));
    }
  });
  ws.on('message', (data: Buffer) => {
    const message: (string | object)[] = JSON.parse(data.toString('utf8'));
    switch (message[0]) {
      case 'EVENT':
        console.debug('Received EVENT for: %s', message[1]);
        if (typeof message[2] !== 'object') throw new Error('Invalid event');
        const event: NostrEvent = message[2] as NostrEvent;
        switch (message[1]) {
          case SUBSCRIPTION_NAME:
            if (0 < Number(getTagValue(event, 'amount'))) {
              ++nonZeroBalances;
            }
            break;
          case IDENTITY_TRANSFERS:
            const oldPubkey = getTagValue(event, 'delegation');
            if (oldPubkey) {
              dValues.add(`balance:BTC:${oldPubkey}`);
            }
            latestTimestamp = event.created_at;
            break;
          default:
            console.warn(
              "Received non d non t event, don't know how to handle",
            );
            console.dir(event);
            return;
        }
        break;
      case 'EOSE':
        const subName = message[1] as string;
        console.debug('Received EOSE for: %s', subName);
        ws.send(JSON.stringify(getCloseMessage(subName)));
        if (SUBSCRIPTION_NAME === subName) {
          ws.close();
        }
        break;
      case 'NOTICE':
        console.warn('Received notice: %s', message[1]);
        ws.close();
        break;
      default:
    }
  });
  return new Promise((resolve, reject) => {
    ws.on('close', () => {
      console.log([...dValues.values()]);
      resolve({
        totalIdentityTransfers,
        nonZeroBalances,
      });
    });
    ws.on('error', reject);
    ws.on('unexpected-response', reject);
  });
}

function analyze(metrics: Metrics): HealthLevel {
  let level: number = 1;
  const reasons: string[] = [];
  if (0 < metrics.totalIdentityTransfers) {
    level = 1 - metrics.nonZeroBalances / metrics.totalIdentityTransfers;
    if (level < 1) {
      reasons.push(`${Math.floor(level * 100)}% of transactions are failing`);
    }
  }
  return { level: Math.floor(level * 100), reasons };
}

export default { monitor, analyze, INTERVAL_MS };

import { WebSocket } from 'ws';

import { HealthLevel } from '@lib/alerts';
import { getCloseMessage, getTagValue, NostrEvent, REQ } from '@lib/events';

type Metrics = {
  heat: number;
};

const INTERVAL_MS = 5000;
const SUBSCRIPTION_NAME = 'gatewayBalance';
const MAX_HEAT = 12;
const req: REQ = [
  'REQ',
  SUBSCRIPTION_NAME,
  {
    kinds: [31111],
    '#d': [`balance:BTC:${process.env.GATEWAY_PUBKEY}`],
  },
];
let heat: number = 0;
let lastAmount: number;

async function monitor(): Promise<Metrics> {
  const relayUrl: string = process.env.NOSTR_RELAY ?? '';
  let ws: WebSocket;
  try {
    ws = new WebSocket(relayUrl);
  } catch (e) {
    return Promise.reject(e);
  }
  ws.on('open', () => {
    ws.send(JSON.stringify(req));
  });
  ws.on('message', (data: Buffer) => {
    const message: (string | object)[] = JSON.parse(data.toString('utf8'));
    switch (message[0]) {
      case 'EVENT':
        console.debug('Received EVENT');
        if (typeof message[2] !== 'object') throw new Error('Invalid event');
        const event: NostrEvent = message[2] as NostrEvent;
        const amount: number = Number(getTagValue(event, 'amount'));
        if (0 < amount) {
          if (amount < lastAmount) {
            heat = 0 === heat ? 0 : --heat;
          } else {
            ++heat;
          }
        } else {
          heat = 0;
        }
        lastAmount = amount;
        break;
      case 'EOSE':
        console.debug('Received EOSE');
        ws.send(JSON.stringify(getCloseMessage(SUBSCRIPTION_NAME)));
        ws.close();
        break;
      case 'NOTICE':
        console.warn('Received notice: %s', message[1]);
        ws.close();
        break;
      default:
    }
  });
  return new Promise((resolve, reject) => {
    ws.on('close', () => resolve({ heat }));
    ws.on('error', reject);
    ws.on('unexpected-response', reject);
  });
}

function analyze(metrics: Metrics): HealthLevel {
  const level: number =
    1 < metrics.heat
      ? (Math.max(MAX_HEAT, metrics.heat) - metrics.heat) / MAX_HEAT
      : 1;
  const reasons: string[] = [];
  if (level < 1) {
    reasons.push(
      level < 0.5
        ? 'Gateway amount is increasing constanlty'
        : 'Gateway amount is increasing',
    );
  }
  return { level: Math.floor(level * 100), reasons };
}

export default { monitor, analyze, INTERVAL_MS };

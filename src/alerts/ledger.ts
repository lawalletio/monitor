import { WebSocket } from 'ws';

type NostrEvent = {
  id: string;
  kind: number;
  pubkey: string;
  created_at: number;
  content: string;
  tags: string[][];
  sig: string;
};

type Filter = {
  kinds?: number[];
  since?: number;
  until?: number;
  '#t': string[];
};

type Metrics = {
  resolved: number;
  unresolved: number;
  maxDuration: number;
  minDuration: number;
  averageDuration: number;
  slowTransactions: Record<string, number>;
};

type REQ = ['REQ', string, Filter];

enum EventSequence {
  START,
  END,
}

const DURATION_THRESHOLD = 2;
const SUBSCRIPTION_NAME = 'internalTransactions';
const CLOSE_MESSAGE = ['CLOSE', SUBSCRIPTION_NAME];
let transactionTimestamps: Record<string, [number, number]> = {};
let seenEvents: number = 0;
let durationSum: number = 0;
let req: REQ;
let latestTimestamp: number;

function getTagValue(event: NostrEvent, tagName: string): string | undefined {
  const tag: string[] | undefined = event.tags.find((t) => t[0] === tagName);
  return tag?.at(1);
}

function getReqMessage(): REQ {
  return [
    'REQ',
    SUBSCRIPTION_NAME,
    {
      kinds: [1112],
      '#t': [
        'internal-transaction-start',
        'internal-transaction-ok',
        'internal-transaction-error',
        'inbound-transaction-start',
        'inbound-transaction-ok',
        'inbound-transaction-error',
        'outbound-transaction-start',
        'outbound-transaction-ok',
        'outbound-transaction-error',
      ],
      since: Math.round(Date.now() / 1000) - 70,
      until: Math.round(Date.now() / 1000) - 5,
    },
  ];
}

function handleEvent(
  txTimestamps: Record<string, [number, number]>,
  event: NostrEvent,
  metrics: Metrics,
  sequence: EventSequence,
) {
  const startId: string | undefined =
    sequence === EventSequence.START ? event.id : getTagValue(event, 'e');
  if (!startId)
    throw new Error('Received invalid event, could not extract start id');
  if (startId in txTimestamps) {
    const timestamps = txTimestamps[startId];
    if (!isNaN(timestamps[0]) && !isNaN(timestamps[1])) {
      //pagination
      return;
    }
    timestamps[sequence] = event.created_at;
    if (isNaN(timestamps[0]) || isNaN(timestamps[1])) return; //pagination overlap
    const duration = timestamps[1] - timestamps[0];
    ++metrics.resolved;
    --metrics.unresolved;
    metrics.maxDuration = Math.max(metrics.maxDuration, duration);
    metrics.minDuration = Math.min(metrics.minDuration, duration);
    durationSum += duration;
    if (DURATION_THRESHOLD < duration) {
      metrics.slowTransactions[startId] = duration;
    }
  } else {
    txTimestamps[startId] = [NaN, NaN];
    txTimestamps[startId][sequence] = event.created_at;
    ++metrics.unresolved;
  }
}

function initMetrics(): Metrics {
  seenEvents = 0;
  durationSum = 0;
  transactionTimestamps = {};
  req = getReqMessage();
  return {
    resolved: 0,
    unresolved: 0,
    maxDuration: Number.NEGATIVE_INFINITY,
    minDuration: Number.POSITIVE_INFINITY,
    averageDuration: 0,
    slowTransactions: {},
  };
}

function getSequence(subkind: string): EventSequence {
  let sequence: EventSequence;
  switch (subkind) {
    case 'internal-transaction-start':
    case 'inbound-transaction-start':
    case 'outbound-transaction-start':
      sequence = EventSequence.START;
      break;
    case 'internal-transaction-ok':
    case 'inbound-transaction-ok':
    case 'outbound-transaction-ok':
    case 'internal-transaction-error':
    case 'inbound-transaction-error':
    case 'outbound-transaction-error':
      sequence = EventSequence.END;
      break;
    default:
      console.log('Unexpected subkind: %s', subkind);
      throw new Error('Unexpected subkind of event received');
  }
  return sequence;
}

function handleMessage(data: Buffer, ws: WebSocket, metrics: Metrics): void {
  const message: (string | object)[] = JSON.parse(data.toString('utf8'));
  switch (message[0]) {
    case 'EVENT':
      console.debug('Received EVENT');
      ++seenEvents;
      if (typeof message[2] !== 'object') throw new Error('Invalid event');
      const event: NostrEvent = message[2] as NostrEvent;
      const subkindTag: string[] | undefined = event.tags.find(
        (t) => 't' === t[0],
      );
      const subkind: string = subkindTag ? subkindTag[1] : '';
      latestTimestamp = event.created_at;
      handleEvent(transactionTimestamps, event, metrics, getSequence(subkind));
      break;
    case 'EOSE':
      console.debug('Received EOSE');
      if (0 < seenEvents && latestTimestamp !== req[2].since) {
        seenEvents = 0;
        console.log('paginating...');
        req[2].since = latestTimestamp;
        ws.send(JSON.stringify(req));
        return;
      }
      metrics.averageDuration = durationSum / metrics.resolved;
      ws.send(JSON.stringify(CLOSE_MESSAGE));
      ws.close();
      break;
    case 'NOTICE':
      console.warn('Received notice: %s', message[1]);
      ws.close();
      break;
    default:
  }
}

export async function monitorLedgerTransactions(): Promise<Metrics> {
  const metrics: Metrics = initMetrics();
  const relayUrl: string = process.env.NOSTR_RELAY ?? '';
  console.debug('Opening connection to %s', relayUrl);
  const ws = new WebSocket(relayUrl);
  ws.on('open', () => {
    ws.send(JSON.stringify(req));
  });
  ws.on('message', (data: Buffer) => handleMessage(data, ws, metrics));
  return new Promise((resolve, reject) => {
    ws.on('close', () => resolve(metrics));
    ws.on('error', reject);
    ws.on('unexpected-response', reject);
  });
}

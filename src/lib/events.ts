export type NostrEvent = {
  id: string;
  kind: number;
  pubkey: string;
  created_at: number;
  content: string;
  tags: string[][];
  sig: string;
};

export type Filter = {
  kinds?: number[];
  since?: number;
  until?: number;
  '#t': string[];
};

export type CLOSE = ['CLOSE', string];
export type REQ = ['REQ', string, Filter];

export function getCloseMessage(subName: string): CLOSE {
  return ['CLOSE', subName];
}

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
  '#t'?: string[];
  '#d'?: string[];
};

export type CLOSE = ['CLOSE', string];
export type REQ = ['REQ', string, Filter];

export function getCloseMessage(subName: string): CLOSE {
  return ['CLOSE', subName];
}

export function getTagValue(
  event: NostrEvent,
  tagName: string,
): string | undefined {
  const tag: string[] | undefined = event.tags.find((t) => t[0] === tagName);
  return tag?.at(1);
}

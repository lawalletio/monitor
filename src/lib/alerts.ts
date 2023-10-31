export type HealthLevel = {
  level: number;
  reasons: string[];
};

export type Alert<Metric> = {
  monitor: () => Promise<Metric>;
  analyze: (metrics: Metric) => { level: number; reasons: string[] };
  INTERVAL_MS: number;
};

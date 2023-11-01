export type HealthLevel = {
  level: number;
  reasons: string[];
  timestamp?: number;
};

export type Alert<Metric> = {
  monitor: () => Promise<Metric>;
  analyze: (metrics: Metric) => HealthLevel;
  INTERVAL_MS: number;
};

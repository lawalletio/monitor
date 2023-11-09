import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';

import * as alerts from '@alerts/index';
import { Alert, HealthLevel } from '@lib/alerts';
import { LimitedQueue } from '@lib/utils';

const PORT = process.env.PORT || 8000;
const MAX_LEVELS = 10;
const SUCCESS_LEVEL = 100;
const INESTABLE_THRESHOLD = 75;
const FAIL_THRESHOLD = 25;
const REPORTS: Record<string, HealthReport> = {};

type HealthReport = {
  lastSuccess?: number;
  inestableSince?: number;
  failingSince?: number;
  healthLevels: LimitedQueue<HealthLevel>;
};

function runAlert(alertEntry: [string, Alert<any>]): void {
  const [alertName, alert]: [string, Alert<any>] = alertEntry;
  alert
    .monitor()
    .then((metrics) => {
      const healthLevel = alert.analyze(metrics);
      const now = Date.now();
      healthLevel.timestamp = now;
      REPORTS[alertName].healthLevels.enqueue(healthLevel);
      if (SUCCESS_LEVEL === healthLevel.level) {
        REPORTS[alertName].lastSuccess = now;
        delete REPORTS[alertName].inestableSince;
        delete REPORTS[alertName].failingSince;
      } else if (healthLevel.level < INESTABLE_THRESHOLD) {
        if (!REPORTS[alertName].inestableSince) {
          REPORTS[alertName].inestableSince = now;
        }
        if (
          healthLevel.level < FAIL_THRESHOLD &&
          !REPORTS[alertName].failingSince
        ) {
          REPORTS[alertName].failingSince = now;
        }
      } else {
        delete REPORTS[alertName].inestableSince;
        delete REPORTS[alertName].failingSince;
      }
      console.log(new Date());
      console.dir(metrics);
      console.dir(healthLevel);
      console.log('------------------------');
    })
    .catch(console.error);
}

function setupAlert(alertEntry: [string, Alert<any>]): void {
  const [alertName, alert]: [string, Alert<any>] = alertEntry;
  REPORTS[alertName] = {
    healthLevels: new LimitedQueue<HealthLevel>(MAX_LEVELS),
  };
  runAlert(alertEntry);
  setInterval(() => {
    runAlert(alertEntry);
  }, alert.INTERVAL_MS);
}

// Start alerts
for (const aEntry of Object.entries(alerts)) {
  console.log('Setting up alert: %s', aEntry[0]);
  setupAlert(aEntry);
}

// Instantiate express
const app = express();
app.use(morgan('dev'));
app.use(helmet());
app.use(express.json());
app.use(cors());

app.route('/status').get((_req, res, _next) => {
  const body = Object.fromEntries(
    Object.entries(REPORTS).map(([k, v]) => [
      k,
      { ...v, healthLevels: v.healthLevels.toArray() },
    ]),
  );
  res.status(200).json(body).send();
});

app.listen(PORT, () => {
  console.log('Server is running on port %s', PORT);
});

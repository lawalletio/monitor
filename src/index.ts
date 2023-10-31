import * as alerts from '@alerts/index';
import { Alert } from '@lib/alerts';


function setupAlert(alert_: Alert<any>): void {
  alert_
    .monitor()
    .then((metrics) => {
      console.log(new Date());
      console.dir(metrics);
      console.dir(alert_.analyze(metrics));
      console.log('------------------------');
    })
    .catch(console.error);
  setInterval(() => {
    alert_
      .monitor()
      .then((metrics) => {
        console.log(new Date());
        console.dir(metrics);
        console.dir(alert_.analyze(metrics));
        console.log('------------------------');
      })
      .catch(console.error);
  }, alert_.INTERVAL_MS);
}

for (const aEntry of Object.entries(alerts)) {
  console.log('Setting up alert: %s', aEntry[0]);
  setupAlert(aEntry[1]);
}

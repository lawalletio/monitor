import { monitorLedgerTransactions } from '@alerts/ledger';

monitorLedgerTransactions()
  .then((metrics) => {
    console.log(new Date());
    console.dir(metrics);
    console.log('------------------------');
  })
  .catch(console.error);
setInterval(() => {
  monitorLedgerTransactions()
    .then((metrics) => {
      console.log(new Date());
      console.dir(metrics);
      console.log('------------------------');
    })
    .catch(console.error);
}, 60000);

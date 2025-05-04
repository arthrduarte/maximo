import { checkForMissedCalls } from './scriptFunctions';

(async () => {
  console.log('Starting the no show message script...');
  await checkForMissedCalls();
  console.log('No show message script completed.');
})(); 
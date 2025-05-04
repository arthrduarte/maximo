import { sendCallReminderOnTime } from './scriptFunctions';

(async () => {
  console.log('Starting the call reminder on time script...');
  await sendCallReminderOnTime();
  console.log('Call reminder on time script completed.');
})(); 
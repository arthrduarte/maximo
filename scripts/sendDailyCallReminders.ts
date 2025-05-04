import { sendDailyCallReminders } from './scriptFunctions';

(async () => {
  console.log('Starting the daily call reminders script...');
  await sendDailyCallReminders();
  console.log('Daily call reminders script completed.');
})(); 
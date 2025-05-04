import { sendMessageAfterInactivity } from './scriptFunctions';

// ====================================================================================================================
//
// EXTREMELY IMPORTANT:
// THIS SCRIPT CAN'T BE RUN ON DEVELOPMENT BECAUSE IT WILL SEND MESSAGES TO ALL USERS USING THE DEVELOPER PHONE NUMBER
//
// ====================================================================================================================
(async () => {
  console.log('Starting the inactivity messages script...');
  await sendMessageAfterInactivity();
  console.log('Inactivity messages script completed.');
})(); 
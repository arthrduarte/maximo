import { Router } from 'express';
import { 
  getUsers, 
  getUserConversations,
  getEntities,
  getActionItems,
  getMessages,
  getScheduledCalls,
  getDetailedSummaries,
  getShortSummaries,
  getSMSSummaries,
  getAllProfiles,
  sendUserSMS
} from '../controllers/admin.controller.js';

const router = Router();

// Admin routes
router.get('/users', getUsers);
router.get('/profiles', getAllProfiles);

// Profile-specific routes
router.get('/profiles/:profileId/conversations', getUserConversations);
router.get('/profiles/:profileId/entities', getEntities);
router.get('/profiles/:profileId/action-items', getActionItems);
router.get('/profiles/:profileId/messages', getMessages);
router.get('/profiles/:profileId/scheduled-calls', getScheduledCalls);
router.get('/profiles/:profileId/summaries/detailed', getDetailedSummaries);
router.get('/profiles/:profileId/summaries/short', getShortSummaries);
router.get('/profiles/:profileId/summaries/sms', getSMSSummaries);

// SMS route
router.post('/send-sms', sendUserSMS);

export default router; 
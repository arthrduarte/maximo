import express from 'express';
import { router as smsRoutes } from './sms.routes.js';

export async function createMessagesRouter() {
    const router = express.Router();
    router.use(smsRoutes);
    return router;
}

export default createMessagesRouter; 
import { Request, Response } from 'express';
import { getUserProfile, normalizePhoneNumber, sendSMS } from '../services/sms.service.js';
import { initiateOutboundCall } from '../../twilio.js';
import { WelcomeMessageRequest } from '../types';

export async function handleWelcomeMessage(req: Request<{}, {}, WelcomeMessageRequest>, res: Response) {
    try {
        console.log('Received welcome message request:');

        const { phone, firstName } = req.body;
        if (!phone) {
            console.error('Missing phone number in request body');
            return res.status(400).json({ error: 'Phone number is required' });
        }

        const profile = await getUserProfile(phone);
        if (!profile) {
            return res.status(500).json({ error: 'Failed to fetch profile or profile not found' });
        }

        const formattedPhone = normalizePhoneNumber(phone);

        // Use the person's name in the welcome message if provided
        const regulationMessage = "You have successfully signed up for Maximo AI Executive Coaching. Maximo will send you coaching SMS messages & book calls with you to help achieve your professional goals. For support and to stop contact please email team@meetmaximo.com, you can also reply STOP to cancel communication. Msg frequency varies based on your usage. Msg & data rates may apply."

        const welcomeMessage1 =
            `Hi ${firstName || 'there'}, nice to meet you! I'm Maximo, your AI Executive Coach! I'm here to help you achieve your professional goals.`

        const welcomeMessage2 =
            `Give me a minute and I'll be calling you. In the meantime, you can save my number to your contacts by clicking this link: https://meetmaximo.com/save-contact\n\n`

        if (normalizePhoneNumber(formattedPhone).startsWith('+1')) {
            console.log('US number detected - Sending regulation message...');
            await sendSMS(formattedPhone, regulationMessage, profile.id);

            await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
            console.log('Non-US number detected - Skipping regulation message');
        }

        console.log('Attempting to send welcome SMS with contact info');
        await sendSMS(formattedPhone, welcomeMessage1, profile.id);

        await new Promise(resolve => setTimeout(resolve, 5000));
        await sendSMS(formattedPhone, welcomeMessage2, profile.id);

        console.log('All messages sent successfully');

        await new Promise(resolve => setTimeout(resolve, 10000));
        await initiateOutboundCall(formattedPhone);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error sending welcome messages:', error);
        res.status(500).json({ error: 'Failed to send welcome messages', details: error instanceof Error ? error.message : 'Unknown error' });
    }
} 
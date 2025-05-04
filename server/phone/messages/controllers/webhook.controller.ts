import { Response } from 'express';
import {
    normalizePhoneNumber,
    sendSMS,
    getUserProfile,
    getUserHistory,
    analyzeCallRequest
} from '../services/sms.service.js';
import {
    isUserRescheduling,
    setUserRescheduling,
    analyzeRescheduleRequest,
    handleRescheduling
} from '../services/scheduling.service.js';
import { generateCoachingResponse } from '../../claude.js';
import { initiateOutboundCall } from '../../twilio.js';
import { storeSmsSummary } from '../../functions/summaries/index.js';
import { TwilioWebhookRequest } from '../types';

export async function handleSmsWebhook(req: TwilioWebhookRequest, res: Response) {
    if (req.isRateLimited) {
        console.log('🚫 Request is rate limited, returning empty response');
        return res.status(200).type('text/xml').send(`
      <?xml version="1.0" encoding="UTF-8"?>
      <Response></Response>
    `);
    }

    let sentResponse = false;
    const { From: phone, Body: message } = req.body;

    try {
        if (!phone || typeof message === 'undefined') {
            console.error('❌ Missing required fields in webhook body');
            return res.status(400).type('text/xml').send(`
        <?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>Invalid request format: Missing phone number or message body.</Message>
        </Response>
      `);
        }

        const normalizedPhone = normalizePhoneNumber(phone);
        const profile = await getUserProfile(normalizedPhone);

        if (!profile) {
            console.log('No profile found, asking user to sign up');
            await sendSMS(
                normalizedPhone,
                "Welcome! To start chatting with me, please sign up first at www.meetmaximo.com. " +
                "Once you verify your phone number, you can text me directly!",
            );
            return res.status(200).type('text/xml').send(`
        <?xml version="1.0" encoding="UTF-8"?>
        <Response></Response>
      `);
        }

        // Handle rescheduling flow
        if (isUserRescheduling(normalizedPhone)) {
            console.log('==== User is in the rescheduling process ====');
            const schedulingResult = await handleRescheduling(profile.id, message, true);

            if (schedulingResult?.success) {
                await sendSMS(normalizedPhone, "Of course! Give me a moment.", profile.id);
            }

            setUserRescheduling(normalizedPhone, false);
            sentResponse = true;
            return res.status(200).type('text/xml').send(`
        <?xml version="1.0" encoding="UTF-8"?>
        <Response></Response>
      `);
        }

        const rescheduleResult = await analyzeRescheduleRequest(message);
        if (rescheduleResult.wantsToReschedule) {
            if (!rescheduleResult.newCallTime) {
                await sendSMS(
                    normalizedPhone,
                    "I'd be happy to reschedule our call. What date and time works best for you?",
                    profile.id
                );

                setUserRescheduling(normalizedPhone, true);
                sentResponse = true;
                return res.status(200).type('text/xml').send(`
          <?xml version="1.0" encoding="UTF-8"?>
          <Response></Response>
        `);
            } else {
                const schedulingResult = await handleRescheduling(profile.id, rescheduleResult.newCallTime, true);
                if (schedulingResult?.success) {
                    await sendSMS(normalizedPhone, "Of course! Give me a moment.", profile.id);
                }
                sentResponse = true;
                return res.status(200).type('text/xml').send(`
          <?xml version="1.0" encoding="UTF-8"?>
          <Response></Response>
        `);
            }
        }

        // Check if the user is requesting a call
        const isCallRequest = await analyzeCallRequest(message);
        if (isCallRequest) {
            console.log('✅ Call request detected');
            const callSid = await initiateOutboundCall(normalizedPhone);

            if (callSid) {
                console.log('✅ Call initiated successfully');
                await sendSMS(
                    normalizedPhone,
                    "I'll call you right now! Please answer your phone.",
                    profile.id
                );
            } else {
                await sendSMS(
                    normalizedPhone,
                    "I'm sorry, I couldn't initiate a call at this moment. Please call me so we can chat.",
                    profile.id
                );
            }

            sentResponse = true;
            return res.status(200).type('text/xml').send(`
        <?xml version="1.0" encoding="UTF-8"?>
        <Response></Response>
      `);
        }

        // Get user history and generate response
        const history = await getUserHistory(profile.id);

        const allInteractions = [
            ...history.messageHistory.map(m => ({
                ...m,
                type: 'SMS'
            })),
            ...history.conversationHistory.flatMap(c =>
                (c.transcription || []).map((t: { text: string; speaker: string; timestamp: number }) => ({
                    content: t.text,
                    sender: t.speaker,
                    created_at: new Date(t.timestamp).toISOString(),
                    type: 'Call'
                }))
            )
        ].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        const smsSummaryContext = history.smsSummaries.length > 0
            ? `SMS Conversation Summaries:\n${history.smsSummaries
                .map(summary => `- ${summary.content}`)
                .join('\n')}`
            : '';

        const response = await generateCoachingResponse({
            userHistory: [
                ...(smsSummaryContext ? [smsSummaryContext] : []),
                ...allInteractions.map(m => {
                    const prefix = m.sender === 'user' ? 'User' : 'Assistant';
                    const medium = `[${m.type}]`;
                    return `${medium} ${prefix}: ${m.content}`;
                }),
                '[SMS] User: ' + message
            ],
            currentTopic: 'business_advice',
            phone: normalizedPhone
        });

        await sendSMS(normalizedPhone, response.message, profile.id);
        sentResponse = true;

        // Create SMS summaries if needed
        try {
            await storeSmsSummary(profile.id);
        } catch (summaryError) {
            console.error('Error creating SMS summaries:', summaryError instanceof Error ? summaryError.message : 'Unknown error');
        }

        return res.status(200).type('text/xml').send(`
      <?xml version="1.0" encoding="UTF-8"?>
      <Response></Response>
    `);
    } catch (error) {
        console.error('Error handling message:', error instanceof Error ? error.message : 'Unknown error');
        if (!sentResponse) {
            try {
                await sendSMS(
                    phone,
                    "I apologize, but I'm having trouble processing your message right now. Please try again in a few minutes.",
                );
            } catch (smsError) {
                console.error('Error sending error SMS:', smsError);
            }
        }
        return res.status(200).type('text/xml').send(`
      <?xml version="1.0" encoding="UTF-8"?>
      <Response></Response>
    `);
    }
} 
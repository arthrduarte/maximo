import { Request } from 'express';

export interface WelcomeMessageRequest {
  phone: string;
  firstName: string;
}

export interface SmsWebhookBody {
  From: string;
  Body: string;
}

export interface TwilioWebhookRequest extends Request {
  body: SmsWebhookBody;
  isRateLimited?: boolean;
}

export interface SchedulingResult {
  success: boolean;
  error?: string;
}

export interface RescheduleAnalysis {
  wantsToReschedule: boolean;
  newCallTime?: string;
} 
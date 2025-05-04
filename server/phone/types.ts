export interface Interaction {
  sender: string;
  content: string;
  created_at: string;
  type: 'sms' | 'call';
} 
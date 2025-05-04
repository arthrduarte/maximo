export interface Database {
  profiles: {
    id: string
    user_id: string
    phone: string
    first_name: string
    last_name: string
    email: string
    is_active: boolean
    role: string
    timezone: string // Example of stored value: "America/Toronto"
    created_at: string
  },
  messages: {
    id: string
    profile_id: string
    sender: string
    content: string
    created_at: string
  },
  entities: {
    id: string
    profile_id: string
    content: string
    created_at: string
  },
  summaries_short: {
    id: string
    profile_id: string
    conversation_id: string
    content: string
    created_at: string
  },
  summaries_detailed: {
    id: string
    profile_id: string
    conversation_id: string
    content: string
    created_at: string
  },
  summaries_sms: {
    id: string
    profile_id: string
    content: string
    created_at: string
  },
  conversations: {
    id: string
    profile_id: string
    date: string
    time: string
    call_recording: string
    transcription: JSON[]  // Array of jsonb objects
    type: string // "max" or "sarah"
    voicemail: boolean // FALSE by default
    created_at: string
  },
  scheduled_calls: {
    id: string
    profile_id: string
    event_id: string
    date: string
    time: string
    calendar_invite_sent?: boolean
    reminder_sent?: boolean
    no_show?: boolean
    created_at: string
  },
  action_items:{
    id: string
    profile_id: string
    conversation_id: string
    content: string
    created_at: string
  }
}
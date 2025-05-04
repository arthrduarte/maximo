# Maximo - AI Executive Coach

Maximo is an AI voice agent designed to act as an executive coach. It helps founders, managers, investors, and executives find solutions to their problems through self-reflection and thought-provoking questions delivered via phone calls and SMS.

## Features

*   **AI Coaching Sessions:** Conducts voice calls powered by AI (Claude) to guide users through self-reflection.
*   **Discovery Calls:** Special initial call script to understand the user better upon signup.
*   **Automated Scheduling:** Schedules follow-up calls based on user preference or previous call times.
*   **SMS Communication:** Sends welcome messages, call summaries, call reminders, and encouragement.
*   **Timezone Aware:** Handles scheduling and reminders based on the user's specific timezone (using Luxon).
*   **Admin Panel:** Web interface (`/public/admin`) for viewing scheduled calls, managing users, and admin login.
*   **User Signup:** Captures user phone number and crucial timezone information (`/public/signup`).
*   **Automated Scripts:** Handles reminders, missed calls, and inactivity follow-ups via scheduled tasks.

## Tech Stack

*   **Backend:** Node.js, TypeScript
*   **AI:** Anthropic Claude
*   **Voice Synthesis:** ElevenLabs
*   **Telephony & SMS:** Twilio
*   **Database:** Supabase
*   **Scheduling:** Heroku Scheduler
*   **Timezone Management:** Luxon
*   **Frontend:** (Assumed React/Next.js or similar for `/public` routes)

## Project Structure

```
/
├── db/                  # Supabase types and potentially migrations
│   └── types.ts         # Core database type definitions
├── public/              # Frontend assets and routes (Landing, Signup, Admin)
├── scripts/             # Scheduled scripts (Heroku Scheduler)
│   └── scriptFunctions.ts # Functions for reminders, missed calls, etc.
├── server/              # Backend server logic
│   ├── phone/           # Core voice/SMS/AI logic
│   │   ├── claude.ts      # AI coaching logic
│   │   ├── elevenlabs.ts  # Text-to-speech generation
│   │   ├── sms.ts         # SMS handling
│   │   ├── timezone.ts    # Timezone utilities (Luxon)
│   │   └── twilio.ts      # Voice call handling (outbound, processing)
│   └── web/             # Web server routes/controllers (Admin Panel API)
├── .env.example         # Example environment variables
├── package.json         # Node.js dependencies
└── tsconfig.json        # TypeScript configuration
```

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd maximo
    ```
2.  **Install dependencies:**
    ```bash
    npm install # or yarn install
    ```
3.  **Set up environment variables:**
    *   Copy `.env.example` to `.env`.
    *   Fill in the required API keys and credentials for Supabase, Twilio, ElevenLabs, Anthropic Claude, etc.
4.  **(Database Setup)**: Ensure your Supabase instance is configured according to the schema implied by `db/types.ts`.

## Running the Application

1.  **Start the server:**
    ```bash
    npm run start # or yarn start (adjust based on package.json scripts)
    ```
2.  **Running Scripts:**
    *   The scripts in `/scripts` are designed to be run by Heroku Scheduler or a similar task scheduler. Configure your scheduler to run the necessary functions (e.g., `sendDailyReminders`, `handleMissedCalls`) at the appropriate times.
    *   Manual execution might be possible via `ts-node` or similar, e.g., `npx ts-node ./scripts/scriptFunctions.ts <functionName>` (requires specific implementation).

## Key Functionality

*   **`server/phone/twilio.ts`:** Manages Twilio Voice API interactions, including initiating calls, handling call status updates, and processing incoming speech.
*   **`server/phone/elevenlabs.ts`:** Interfaces with ElevenLabs API to generate realistic voice responses for Maximo.
*   **`server/phone/claude.ts`:** Contains the core logic for interacting with the Claude LLM to generate coaching dialogue.
*   **`server/phone/sms.ts`:** Handles sending and potentially receiving SMS messages via the Twilio Messaging API.
*   **`server/phone/timezone.ts`:** Provides utility functions for handling date/time operations respecting user timezones using Luxon.
*   **`scripts/scriptFunctions.ts`:** Contains functions executed by the scheduler for automated tasks like reminders and follow-ups.
*   **`db/types.ts`:** Defines the TypeScript interfaces matching the Supabase database schema. 
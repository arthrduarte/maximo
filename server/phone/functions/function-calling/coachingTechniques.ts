export interface CoachingTechnique {
  technique: string;
  instruction: string;
  examples?: string[];
}

export const POWERFUL_QUESTIONS: CoachingTechnique = {
  technique: "Powerful Questions",
  instruction: "Use when a client seems stuck, unsure about their next step, or needs deeper self-reflection. The tool will returns examples that you should use as inspiration to generate your response.",
  examples: [
      "What outcome do you truly want from this situation?",
      "If failure weren't an option, what would you do?",
      "What's the biggest assumption you're making right now?",
      "What would your future self thank you for doing today?",
      "If you had all the answers, what would they be?",
      "How would you approach this if you were coaching someone else?",
      "What's the one thing that, if changed, would make the biggest difference?",
      "What's stopping you from making this decision?",
      "How does this align with your long-term goals?",
      "What would happen if you did nothing?"
    ]
}

export const ACTIVE_LISTENING: CoachingTechnique = {
  technique: "Active Listening",
  instruction: "Use when a client is sharing a challenge, expressing emotions, or when clarity is needed. The tool will returns examples that you should use as inspiration to generate your response.",
  examples: [
        "I hear you saying that you feel overwhelmed—what's the biggest source of that?",
        "So if I understand correctly, you're debating between two paths—what's your gut telling you?",
        "You mentioned this isn't the first time you've faced this—how did you handle it before?",
        "It sounds like this decision is really important to you—what's the core reason?",
        "I'm noticing a lot of excitement in your voice—what's lighting you up about this?",
        "You seem hesitant—what's making you pause?",
        "If I reflect back, it sounds like you're feeling stuck due to a lack of clarity. Is that accurate?",
        "It seems like you're trying to balance logic with emotion—what's pulling you in each direction?",
        "What I'm hearing is that you're torn between staying safe and taking a risk. What's your biggest fear?",
        "You've said this is important to you multiple times—what's at stake if you don't take action?"
      ]
}

export const SILENCE_FOR_THINKING: CoachingTechnique = {
  technique: "Silence for Thinking",
  instruction: "Use when a client says that they need to think about your question before answering. The tool will returns examples that you should use as inspiration to generate your response.",
  examples: [
        "No rush!",
        "Of course. Take your time",
        "Don't overthink it, what does your intuition say?",
        "Yeah, I'll give you a moment to think.",
        "Just sit with that thought for a moment",
        "No need to rush, take your time",
      ]
}

export const REFRAME_PERSPECTIVE: CoachingTechnique = {
  technique: "Reframe Perspective",
  instruction: "Use when a client is stuck in a negative mindset and needs to be reframed. The tool will returns examples that you should use as inspiration to generate your response.",
  examples: [
        "What would this look like from an outsider's point of view?",
        "If this were a challenge instead of a problem, how would you approach it?",
        "What's one potential opportunity hidden within this obstacle?",
        "How would you handle this if you were your mentor?",
        "If this was happening to your best friend, what advice would you give them?",
        "How might you see this in a year? Five years?",
        "If this weren't a setback but a setup for something bigger, what could that be?",
        "What's a more empowering way to look at this situation?",
        "If you replaced frustration with curiosity, what would you ask yourself?",
        "What's one thing you can learn from this experience?"
      ]
}

export const CHALLENGE_ASSUMPTIONS: CoachingTechnique = {
  technique: "Challenge Assumptions",
  instruction: "Encouraging clients to question their limiting beliefs or false assumptions. The tool will returns examples that you should use as inspiration to generate your response.",
  examples: [
        "What evidence do you have that supports this belief?",
        "What if the opposite of what you believe is true?",
        "Who told you this was the only way?",
        "What would happen if you ignored this assumption?",
        "Is this a fact or just a feeling?",
        "How could you test this belief?",
        "What's another perspective on this?",
        "If someone you respect disagreed with you, what would they say?",
        "What's stopping you from challenging this belief?",
        "What if this was an opportunity instead of a problem?"
      ]
}

export const ANALOGIES: CoachingTechnique = {
  technique: "Analogies",
  instruction: "Using metaphors or comparisons to simplify complex ideas and make them more relatable. The tool will returns examples that you should use as inspiration to generate your response.",
  examples: [
        "Leading a team is like steering a ship—are you setting the course or reacting to the waves?",
        "Think of this challenge like climbing a mountain—what's your next step?",
        "Your career is like a puzzle—are you forcing pieces together or finding what fits?",
        "This situation is like weightlifting—you grow by embracing resistance.",
        "Think of delegation like cooking—you don't have to make every dish yourself.",
        "Your mindset is like a thermostat—what temperature are you setting for success?",
        "Your energy levels are like a battery—what's draining or recharging you?",
        "This transition is like a relay race—who are you passing the baton to?",
        "Making decisions is like driving—do you have a clear destination?",
        "Your growth is like planting seeds—what are you watering daily?"
      ]

}

export const VISUALIZATION: CoachingTechnique = {
  technique: "Visualization",
  instruction: "Guiding clients to imagine their ideal future to create clarity and motivation. The tool will returns examples that you should use as inspiration to generate your response.",
  examples: [
        "Imagine it's a year from now and everything worked out—what do you see?",
        "Close your eyes—picture yourself walking into your dream role. What does it feel like?",
        "What does success look like for you in vivid detail?",
        "If you had already solved this challenge, what steps did you take?",
        "Picture yourself giving your future self advice—what would you say?",
        "Envision your team thriving—what role are you playing in that?",
        "What does your perfect workday look like?",
        "Imagine you're delivering a TED Talk about overcoming this—what's the key message?",
        "If confidence wasn't an issue, how would you act in this moment?",
        "Visualize the worst-case scenario—now, how would you overcome it?"
      ]
}


export const MANAGING_EMOTIONS: CoachingTechnique = {
  technique: "Managing Emotions",
  instruction: "Helping clients recognize, process, and regulate their emotions to make better decisions. The tool will returns examples that you should use as inspiration to generate your response.",
  examples: [
        "What emotions are present for you right now?",
        "What's beneath the frustration—fear, disappointment, or something else?",
        "How can you shift from feeling stuck to feeling in control?",
        "If you named this emotion, what would it be?",
        "How has this emotion served you in the past?",
        "What's one small action that could improve your emotional state?",
        "What's your go-to strategy for calming yourself down?",
        "What physical signs tell you when you're stressed?",
        "If you reframed this emotion as data, what is it telling you?",
        "How would your best self respond to this situation?"
      ]
}

export const WHAT_SHOULD_I_DO: CoachingTechnique = {
  technique: "What Should I Do",
  instruction: "Use when a user asks for direct advice. Instead of telling them what to do, guide them to their own insights through powerful questions. The tool will returns examples that you should use as inspiration to generate your response.",
  examples: [
    "What options have you considered so far?",
    "What would success look like in this situation?",
    "What's holding you back from making a decision?",
    "Which path feels most aligned with your values?",
    "What would you advise a friend in this situation?",
    "What's the worst that could happen, and how would you handle it?",
    "What does your intuition tell you about this?",
    "What additional information would help you decide?",
    "How does each option align with your long-term goals?",
    "What would make this decision feel easier?"
  ]
}
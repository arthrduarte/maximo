import { 
  POWERFUL_QUESTIONS,
  ACTIVE_LISTENING,
  SILENCE_FOR_THINKING,
  REFRAME_PERSPECTIVE,
  CHALLENGE_ASSUMPTIONS,
  ANALOGIES,
  VISUALIZATION,
  MANAGING_EMOTIONS,
  WHAT_SHOULD_I_DO
} from './coachingTechniques.js';

interface CoachingTechnique {
  technique: string;
  instruction: string;
  examples?: string[];
}

export async function usePowerfulQuestions(): Promise<CoachingTechnique> {
  console.log('Using Powerful Questions technique');
  return POWERFUL_QUESTIONS;
}

export async function useActiveListening(): Promise<CoachingTechnique> {
  console.log('Using Active Listening technique');
  return ACTIVE_LISTENING;
}

export async function useSilenceForThinking(): Promise<CoachingTechnique> {
  console.log('Using Silence for Thinking technique');
  return SILENCE_FOR_THINKING;
}

export async function useReframePerspective(): Promise<CoachingTechnique> {
  console.log('Using Reframe Perspective technique');
  return REFRAME_PERSPECTIVE;
}

export async function handleWhatShouldIDo(): Promise<CoachingTechnique> {
  console.log('🎯 Using What Should I Do technique');
  return WHAT_SHOULD_I_DO;
}
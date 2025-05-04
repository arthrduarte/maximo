import express from 'express';
import {
  usePowerfulQuestions,
  useActiveListening,
  useSilenceForThinking,
  useReframePerspective,
  handleWhatShouldIDo
} from './getCoachingTechnique.js';
import { callOpenAiWebSearch } from '../../openai.js';

const router = express.Router();

// Powerful Questions technique
router.get('/api/tools/powerful-questions', async (req, res) => {
  try {
    const technique = await usePowerfulQuestions();
    res.json(technique);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get powerful questions technique' });
  }
});

// Active Listening technique
router.get('/api/tools/active-listening', async (req, res) => {
  try {
    const technique = await useActiveListening();
    res.json(technique);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get active listening technique' });
  }
});

// Silence for Thinking technique
router.get('/api/tools/silence-thinking', async (req, res) => {
  try {
    const technique = await useSilenceForThinking();
    res.json(technique);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get silence for thinking technique' });
  }
});

// Reframe Perspective technique
router.get('/api/tools/reframe-perspective', async (req, res) => {
  try {
    const technique = await useReframePerspective();
    res.json(technique);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get reframe perspective technique' });
  }
});

// What Should I Do technique
router.get('/api/tools/what-should-i-do', async (req, res) => {
  try {
    const technique = await handleWhatShouldIDo();
    res.json(technique);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get what should I do technique' });
  }
});

router.post('/api/tools/search-the-web', async (req, res) => {
  console.log("🔍 Searching the web for:", req.body.prompt);
  try {
    const searchResults = await callOpenAiWebSearch(req.body.prompt);
    res.json(searchResults);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get search the web technique' });
  }
});
export function createFunctionCallingRouter() {
  return router;
}

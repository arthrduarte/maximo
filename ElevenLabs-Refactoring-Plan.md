# Refactoring Plan: OpenAI Realtime API to Eleven Labs Conversational AI

## 1. Current Architecture Overview

The current implementation relies on OpenAI's Realtime API for voice conversations with the following key components:

1. **Twilio Integration**: Handles phone calls and streams audio between the user and the AI assistant.
2. **WebSocket Communication**: Uses WebSockets to stream audio in real-time to OpenAI's Realtime API.
3. **Function Calling**: Implements coaching techniques through OpenAI's function calling.
4. **Prompt Management**: Uses a system of prompts for different call scenarios (scheduled/unscheduled).
5. **Conversation Data**: Stores conversation data in Supabase.
6. **Post-call Flow**: Manages actions after calls are completed.

## 2. Migration Goals

1. Replace OpenAI Realtime API with Eleven Labs Conversational AI
2. Maintain all existing features and call flows
3. Leverage Eleven Labs' capabilities for better voice quality and lower latency
4. Ensure backward compatibility with the existing database structure

## 3. Required Changes

### Phase 1: Environment and Dependencies Setup

1. **API Keys and Configuration**:
   - Ensure ELEVENLABS_API_KEY is properly configured in environment variables
   - Create necessary agents in Eleven Labs dashboard
   - Configure audio formats to match Twilio requirements (μ-law 8000 Hz)

2. **Update Dependencies**:
   - Verify elevenlabs library is installed (already in package.json)
   - Add any additional dependencies needed for WebSocket implementation

### Phase 2: Agent Creation and Configuration

1. **Create Agents in Eleven Labs**:
   - Create a "Max" agent for scheduled coaching calls
   - Create a "Sarah" agent for unscheduled calls
   - Configure agents with appropriate voices that match the current experience

2. **Knowledge Base Setup**:
   - Import coaching techniques and guidelines
   - Add profile-specific information for personalized interactions

3. **Tool Integration**:
   - Implement custom tools to match current function calling capabilities:
     - usePowerfulQuestions
     - useActiveListening
     - useSilenceForThinking
     - useReframePerspective
     - handleWhatShouldIDo

### Phase 3: Core Code Refactoring

1. **WebSocket Handler Refactoring**:
   - Replace `initializeOpenAIWebSocket` in realtime.ts with Eleven Labs WebSocket implementation
   - Update WebSocket message handling for Eleven Labs' protocol

2. **Audio Processing**:
   - Update `handleAudioBuffer` to match Eleven Labs' audio format requirements
   - Modify audio streaming code to handle Eleven Labs' WebSocket events

3. **System Prompt Integration**:
   - Adapt createSystemPrompt and createSarahUnscheduledCallPrompt functions to work with Eleven Labs
   - Update prompt structure for Eleven Labs agent configuration

4. **Turn-taking and Interruption Handling**:
   - Implement Eleven Labs' turn-taking mechanism
   - Update non-interruptible state handling

### Phase 4: Twilio Integration Updates

1. **Twilio Voice Router**:
   - Update createVoiceRouter in twilio.ts to use Eleven Labs agents
   - Modify WebSocket connection handling for Eleven Labs

2. **Call Status Management**:
   - Update call status tracking for Eleven Labs conversations
   - Modify recording and transcription handling

3. **Post-call Processing**:
   - Update post-call flow to use Eleven Labs conversation data
   - Ensure transcription and data storage remain compatible

### Phase 5: Testing and Optimization

1. **Local Testing**:
   - Test with ngrok for local development
   - Verify audio quality and latency
   - Test all call scenarios (scheduled/unscheduled)

2. **Latency Optimization**:
   - Implement buffer strategies for optimal performance
   - Adjust chunk sizes for better latency

3. **Error Handling**:
   - Update error handling for Eleven Labs specific errors
   - Implement graceful fallbacks

4. **Production Deployment**:
   - Deploy changes in stages to minimize disruption
   - Monitor performance and adjust as needed

## 4. Detailed Implementation Plan

### File Changes:

#### 1. server/phone/realtime.ts
- Create a new file `elevenlabs.ts` to replace functionality
- Implement WebSocket handling for Eleven Labs
- Update audio processing functions
- Implement turn-taking mechanisms

#### 2. server/phone/twilio.ts
- Update WebSocket connection to use Eleven Labs
- Modify audio streaming for compatibility
- Update call initialization

#### 3. server/phone/functions/system-prompt/
- Update prompt creation for Eleven Labs agent compatibility
- Modify prompt format to match Eleven Labs requirements

#### 4. server/phone/functions/function-calling/
- Create custom tools for Eleven Labs to match current function calls
- Adapt coaching techniques implementation

#### 5. server/phone/routes.ts
- Update routes to support Eleven Labs agents
- Modify WebSocket endpoint handling

### Implementation Steps:

**Step 1: Create Eleven Labs Integration Module**
1. Create `server/phone/elevenlabs.ts` with the following functions:
   - `initializeElevenLabsAgent`: To initialize agent with appropriate settings
   - `handleAudioBuffer`: To process and stream audio to Eleven Labs
   - `setupWebSocketHandlers`: To manage WebSocket events

**Step 2: Update Twilio Integration**
1. Modify `createVoiceRouter` to use Eleven Labs agents
2. Update WebSocket connection handling for Eleven Labs
3. Adapt audio format conversions for compatibility

**Step 3: Implement Custom Tools**
1. Create tools for Eleven Labs to match current function calling
2. Adapt coaching techniques to work with Eleven Labs tool calls

**Step 4: Update Prompt System**
1. Adapt system prompts for Eleven Labs agent format
2. Update prompt creation functions

**Step 5: Database and Post-call Flow**
1. Ensure conversation data is stored in the same format
2. Update transcription handling for Eleven Labs

## 5. Timeline and Dependencies

**Week 1: Setup and Initial Development**
- Environment configuration
- Agent creation in Eleven Labs
- Initial code architecture

**Week 2: Core Implementation**
- WebSocket implementation
- Audio handling refactoring
- Tool implementation

**Week 3: Integration and Testing**
- Twilio integration updates
- Full end-to-end testing
- Error handling and optimization

**Week 4: Deployment and Monitoring**
- Staged production deployment
- Performance monitoring
- Final adjustments

## 6. Risks and Mitigation

1. **Audio Quality/Latency Issues**:
   - Mitigation: Implement buffer strategies, test extensively with different network conditions

2. **Tool Compatibility**:
   - Mitigation: Test all coaching techniques thoroughly, implement fallbacks

3. **Database Compatibility**:
   - Mitigation: Ensure new data structure is compatible or implement migration scripts

4. **Transition Period**:
   - Mitigation: Consider A/B testing or gradual rollout to minimize disruption

## 7. Success Metrics

1. Call quality meets or exceeds current standards
2. Latency is equal to or better than current implementation
3. All coaching functions work correctly
4. Database records are maintained correctly
5. User experience is maintained or improved 
import { Request, Response } from 'express';
import { supabaseAdmin } from '@db/supabase.js';
import { sendSMS } from '../../phone/messages/services/sms.service.js';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    const { data: adminProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !adminProfile || adminProfile.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin access required' });
    }

    // Fetch profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return res.status(500).json({ error: 'Failed to fetch profiles' });
    }

    // Fetch scheduled calls for all users
    const { data: scheduledCalls, error: scheduledCallsError } = await supabaseAdmin
      .from('scheduled_calls')
      .select('*')
      .order('date', { ascending: true });

    if (scheduledCallsError) {
      console.error('Error fetching scheduled calls:', scheduledCallsError);
      return res.status(500).json({ error: 'Failed to fetch scheduled calls' });
    }

    // Combine profiles with their scheduled calls
    const combinedData = (profiles || []).map(profile => {
      const profileCalls = (scheduledCalls || []).filter(call => call.profile_id === profile.id);
      return {
        profile,
        scheduled_calls: profileCalls
      };
    });

    // Return array of combined data
    res.json(combinedData);
  } catch (error) {
    console.error('Error in users endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserConversations = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID is required' });
    }

    // Get conversations with their summaries in a single query
    const { data: conversations, error: conversationsError } = await supabaseAdmin
      .from('conversations')
      .select(`
        id,
        transcription,
        created_at,
        call_recording,
        summaries_detailed!inner(content)
      `)
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (conversationsError) {
      console.error('Error fetching conversations:', conversationsError);
      return res.status(500).json({ error: 'Failed to fetch conversations' });
    }

    // Get entities in a single query
    const { data: entities, error: entitiesError } = await supabaseAdmin
      .from('entities')
      .select('content')
      .eq('profile_id', profileId);

    if (entitiesError) {
      console.error('Error fetching entities:', entitiesError);
    }

    const conversationsWithSummaries = conversations?.map(conv => ({
      ...conv,
      entities: entities?.map(e => e.content) || [],
      detailed_summary: conv.summaries_detailed?.[0]?.content || null
    }));

    res.json(conversationsWithSummaries || []);
  } catch (error) {
    console.error('Error in conversations endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEntities = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID is required' });
    }

    const { data: entities, error: entitiesError } = await supabaseAdmin
      .from('entities')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (entitiesError) {
      console.error('Error fetching entities:', entitiesError);
      return res.status(500).json({ error: 'Failed to fetch entities' });
    }

    res.json(entities || []);
  } catch (error) {
    console.error('Error in entities endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getActionItems = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID is required' });
    }

    const { data: actionItems, error: actionItemsError } = await supabaseAdmin
      .from('action_items')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (actionItemsError) {
      console.error('Error fetching action items:', actionItemsError);
      return res.status(500).json({ error: 'Failed to fetch action items' });
    }

    res.json(actionItems || []);
  } catch (error) {
    console.error('Error in action items endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMessages = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID is required' });
    }

    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    res.json(messages || []);
  } catch (error) {
    console.error('Error in messages endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getScheduledCalls = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID is required' });
    }

    const { data: scheduledCalls, error: scheduledCallsError } = await supabaseAdmin
      .from('scheduled_calls')
      .select('*')
      .eq('profile_id', profileId)
      .order('date', { ascending: true });

    if (scheduledCallsError) {
      console.error('Error fetching scheduled calls:', scheduledCallsError);
      return res.status(500).json({ error: 'Failed to fetch scheduled calls' });
    }

    res.json(scheduledCalls || []);
  } catch (error) {
    console.error('Error in scheduled calls endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getDetailedSummaries = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID is required' });
    }

    const { data: summaries, error: summariesError } = await supabaseAdmin
      .from('summaries_detailed')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (summariesError) {
      console.error('Error fetching detailed summaries:', summariesError);
      return res.status(500).json({ error: 'Failed to fetch detailed summaries' });
    }

    res.json(summaries || []);
  } catch (error) {
    console.error('Error in detailed summaries endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getShortSummaries = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID is required' });
    }

    const { data: summaries, error: summariesError } = await supabaseAdmin
      .from('summaries_short')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (summariesError) {
      console.error('Error fetching short summaries:', summariesError);
      return res.status(500).json({ error: 'Failed to fetch short summaries' });
    }

    res.json(summaries || []);
  } catch (error) {
    console.error('Error in short summaries endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSMSSummaries = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID is required' });
    }

    const { data: summaries, error: summariesError } = await supabaseAdmin
      .from('summaries_sms')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (summariesError) {
      console.error('Error fetching SMS summaries:', summariesError);
      return res.status(500).json({ error: 'Failed to fetch SMS summaries' });
    }

    res.json(summaries || []);
  } catch (error) {
    console.error('Error in SMS summaries endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllProfiles = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    const { data: adminProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !adminProfile || adminProfile.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin access required' });
    }

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return res.status(500).json({ error: 'Failed to fetch profiles' });
    }

    res.json(profiles || []);
  } catch (error) {
    console.error('Error in profiles endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendUserSMS = async (req: Request, res: Response) => {
  try {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ error: 'Phone number and message are required' });
    }

    // Verify admin authentication
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    // Get the target user's profile ID
    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('phone', to)
      .single();

    if (targetProfileError || !targetProfile) {
      console.error('Error finding target profile:', targetProfileError);
      return res.status(404).json({ error: 'Target user profile not found' });
    }

    // Send SMS with the target user's profile ID
    await sendSMS(to, message, targetProfile.id);
    res.json({ success: true, message: 'SMS sent successfully' });
  } catch (error: any) {
    console.error('Error sending SMS:', error);
    res.status(500).json({ error: error.message || 'Failed to send SMS' });
  }
}; 
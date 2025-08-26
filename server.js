const express = require('express');
const cors = require('cors');
const path = require('path');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from React build
app.use(express.static(path.join(__dirname, 'frontend/build')));

// Initialize OpenAI client with error handling
let openai = null;
try {
    if (process.env.OPENAI_API_KEY) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    } else {
        console.warn('⚠️ OPENAI_API_KEY not found');
    }
} catch (error) {
    console.error('❌ Failed to initialize OpenAI:', error.message);
}

// Initialize Supabase client with error handling
let supabase = null;
try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    
    if (supabaseUrl && supabaseKey) {
        supabase = createClient(supabaseUrl, supabaseKey);
    } else {
        console.warn('⚠️ Supabase credentials not found');
    }
} catch (error) {
    console.error('❌ Failed to initialize Supabase:', error.message);
}

// Goal-centric conversation system - no longer using category arrays

// Store active sessions (in production, use Redis or database)
const activeSessions = new Map();

// Helper function to get session from database if not in memory (for production)
async function getSession(sessionId) {
    // First try memory (for local development)
    if (activeSessions.has(sessionId)) {
        return activeSessions.get(sessionId);
    }
    
    // If not in memory and supabase is available, try database
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('students')
                .select('*')
                .eq('session_id', sessionId)
                .single();
                
            if (data && !error) {
                // Reconstruct session object
                const session = {
                    sessionId: data.session_id,
                    studentId: data.id,
                    studentData: {
                        name: data.name,
                        age: data.age,
                        location: data.location,
                        highschool: data.highschool || '',
                        gpa: data.gpa || '',
                        satAct: data.sat_act || ''
                    },
                    identifiedMilestones: data.identified_milestones || [],
                    conversationHistory: data.conversation_history || [],
                    phase: data.phase || 'milestone_identification',
                    extracurriculars: data.extracurriculars || []
                };
                
                // Store back in memory for this request
                activeSessions.set(sessionId, session);
                return session;
            }
        } catch (error) {
            console.error('Error fetching session from database:', error);
        }
    }
    
    return null;
}

// Removed old complex conversation system - using simplified approach

// ================================================================================================
// CONVERSATION SYSTEM PROMPTS (Focused only on conversation, not extraction)
// ================================================================================================

// Milestone identification prompt - focused on conversation flow
const MILESTONE_IDENTIFICATION_PROMPT = `
You are an AI counselor that needs to identify the students goals. 

If this is the first message, greet them warmly and ask this EXACT question:
"Hi! If you could fast forward to 2-5 years from now, what long term goal / goals do you have? This could be anything from getting accepted into a dream university, launching your own startup, or becoming a successful practitioner in a field you're passionate about."

When they respond with their goals, immediately identify the key milestone goals and respond with:
"It seems you're mainly interested in [goal 1], [goal 2], and [goal 3]. What extracurriculars have you participated in to reach towards these goals?"

Be concise and direct. Don't ask follow-up questions about their goals - just identify them and move to extracurriculars.

Key milestone categories to identify:
- University acceptance (competitive, top 20, top 10, specialized programs)
- Graduate/Professional school (medical, law, PhD, MBA)
- Business & Entrepreneurship (startup founding, profitable business, VC funding)
- Alternative paths (workforce entry, service year, apprenticeships)
- Scholarships and financial aid

Focus on being efficient and moving the conversation forward quickly.

YOUR ONLY GOAL IS TO IDENTIFY THE STUDENTS GOALS. YOU DONT WANT TO HELP THE STUDENT YET JUST IDENTIFY THE MACRO AND MICRO GOALS`;

// Simplified counselor system
const COUNSELOR_PROMPT = `
You are a goal identifier bot following focused questionnaire to identify the students goals. Don't give advice. JUST ask questions to get a better sense of their GOALS

INSTRUCTIONS:
- Carefully read the conversation history and student context.
- Acknowledge the student's last message briefly.
- Ask ONE next most relevant intermediate-goal question.
- Do NOT repeat topics already covered or explicitly declined in the conversation.
- If a topic is already satisfied (e.g., high SAT), do not bring it up again.
- Tailor questions to the student's milestone goals and extracurriculars.
- CRITICAL: If you've asked 3+ questions about the same topic/theme, MUST transition to a different area.

TOPIC TRANSITION RULES:
- After 3 questions on startup/business → switch to academics, competitions, or leadership
- After 3 questions on academics → switch to extracurriculars, skills, or community service
- After 3 questions on community service → switch to academic goals, research, or personal projects
- After 3 questions on any theme → explore a completely different goal area

RESPONSE FORMAT:
- 1–2 sentences, up to 30 words total.
- Conversational, natural, and specific to their situation.
- No bullet points. No lists. No role prefixes.

TOPIC AREAS TO EXPLORE:
- Academic goals (research, competitions, advanced courses)
- Leadership roles and responsibilities
- Skills development (technical, creative, interpersonal)
- Community service and social impact
- Personal projects and creative pursuits
- Professional experience and internships
- Awards and recognition goals

ALWAYS ALWAYS ASK QUESTIONS ABOUT GOALS. NOTHING ELSE. FOR EXAMPLE THIS IS BAD: 

-"Impressive leadership experience! Are there any academic competitions or advanced courses you're planning to pursue to further enhance your application?"

because it doesn't ask about goals! IT just asks for background which is relevant to attaining the students goals. 

EXAMPLES:
- "That's great progress on community partnerships! What academic short-termgoals are you focusing on this year for your Stanford application?"
- "Your startup work is impressive. What leadership roles are you pursuing to complement your entrepreneurial experience? Do you have any goals for where you want to be in a few months?"
- "Nice! Beyond service work, goals do you have for expanding your arsinal of ECs? Do you want to get an internship?"

 MOST IMPORTANTLY, just identify different goal  nothing else ask about goals incoporate the goal language into most questions.`;

// Milestone goal classification (for conversation only)
async function classifyMilestoneGoals(userInput) {
    try {
        const extractionPrompt = `
Analyze this student response about their 2-5 year goals and identify the most relevant milestone goals.

Student Response: "${userInput}"

Look for mentions of:
- Specific universities (MIT, Stanford, Harvard, etc.) 
- University tiers ("top 10", "elite", "Ivy League", "prestigious")
- Career fields (engineering, medicine, business, etc.)
- Entrepreneurship/startup aspirations
- Graduate school plans
- Professional goals

IMPORTANT: "top 10 university", "elite university", "prestigious college" should ALL map to "top_10_university_acceptance"

Map to these milestone categories:

EDUCATION:
- top_10_university_acceptance (MIT, Stanford, Harvard, Caltech, etc.)
- top_20_university_acceptance (other elite universities)
- competitive_university_acceptance (good universities, top 50)
- specialized_program_acceptance (engineering programs, honors, BS/MD, etc.)

GRADUATE/PROFESSIONAL:
- graduate_school_stem (PhD, research programs in STEM)
- business_school_path (MBA programs)
- medical_school_path, law_school_path

ENTREPRENEURSHIP:
- startup_founding (starting a company/startup)
- profitable_business (building successful business)
- venture_capital_funding (raising VC money)

Examples:
- "MIT mechanical engineering" → ["top_10_university_acceptance", "specialized_program_acceptance"]
- "startup after college" → ["startup_founding", "competitive_university_acceptance"]
- "medical school" → ["medical_school_path", "competitive_university_acceptance"]
- "top 10 university" → ["top_10_university_acceptance"]
- "get into a top university" → ["top_10_university_acceptance"]
- "elite college" → ["top_10_university_acceptance"]

Return JSON array of 1-3 most relevant goals: ["goal1", "goal2", "goal3"]
If unclear, return empty array: []
`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a goal extraction AI. Return only valid JSON arrays with milestone goal names.' },
                { role: 'user', content: extractionPrompt }
            ],
            max_tokens: 100,
            temperature: 0.1
        });

        const aiResponse = response.choices[0].message.content.trim();
        
        try {
            const goals = JSON.parse(aiResponse);
            return Array.isArray(goals) ? goals.slice(0, 3) : [];
        } catch (parseError) {
            console.log('Goal extraction parse error:', aiResponse);
            return [];
        }
    } catch (error) {
        console.error('Error classifying milestone goals:', error);
        return [];
    }
}

// New conversation functions
async function getMilestoneConversation(sessionId, userInput, isFirstQuestion = false) {
    try {
        const session = await getSession(sessionId);
        if (!session) throw new Error('Session not found');

        let specificPrompt;
        
        if (isFirstQuestion) {
            const schoolInfo = session.studentHighschool ? ` attending ${session.studentHighschool}` : '';
            specificPrompt = `This is the first conversation with ${session.studentName}, age ${session.studentAge}, from ${session.studentLocation}${schoolInfo}. Start the milestone identification conversation naturally by greeting them warmly and asking the exact question about their 2-5 year goals.`;
        } else {
            // Classify milestone goals from their response (conversation-only)
            const extractedGoals = await classifyMilestoneGoals(userInput);
            console.log('Extracted goals from "' + userInput + '":', extractedGoals);
            
            if (extractedGoals.length > 0) {
                // Store the identified milestones
                session.identifiedMilestones = extractedGoals;
                
                // Create human-readable goal names for the response
                const goalNames = extractedGoals.map(goal => {
                    return goal.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
                });
                
                const goalList = goalNames.length === 1 ? goalNames[0] : 
                               goalNames.length === 2 ? `${goalNames[0]} and ${goalNames[1]}` :
                               `${goalNames.slice(0, -1).join(', ')}, and ${goalNames[goalNames.length - 1]}`;
                
                const response = `Great! I can see you're focused on ${goalList}. Would you like to share some of your extracurricular activities and experiences that relate to these goals? This will help me give you more targeted advice.`;
                
                // Store conversation and transition to extracurricular question
                session.conversationHistory.push({ role: 'user', content: userInput });
                session.conversationHistory.push({ role: 'assistant', content: response });
                session.phase = 'extracurricular_question';
                
                return response;
            } else {
                console.log('No goals extracted, continuing milestone identification');
                specificPrompt = `Continue the milestone identification conversation. The student just said: "${userInput}". They haven't clearly stated their goals yet, so ask a follow-up question to help them clarify their 2-5 year aspirations.`;
            }
        }

        const messages = [
            { role: 'system', content: MILESTONE_IDENTIFICATION_PROMPT },
            { role: 'user', content: specificPrompt }
        ];

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            max_tokens: 250,
            temperature: 0.3
        });

        const aiResponse = response.choices[0].message.content;
        
        // Store conversation
        if (!isFirstQuestion) {
            session.conversationHistory.push({ role: 'user', content: userInput });
        }
        session.conversationHistory.push({ role: 'assistant', content: aiResponse });

        // Note: Data extraction is now handled separately via the summary endpoint

        return aiResponse;
    } catch (error) {
        console.error('Error getting milestone response:', error);
        return "What are your biggest goals for the next few years?";
    }
}

async function getIntermediateConversation(sessionId, userInput) {
    try {
        const session = await getSession(sessionId);
        if (!session) throw new Error('Session not found');

        const milestoneGoals = session.identifiedMilestones || [];
        const extracurriculars = session.extracurriculars || [];

        const milestoneText = milestoneGoals.map(goal => goal.replace(/_/g, ' ')).join(', ') || 'a competitive university';
        const extracurricularsText = extracurriculars.map(ec => `${ec.title}: ${ec.description}`).join('; ');

        // Provide conversation history for context
        const recentHistory = session.conversationHistory.slice(-8);

        const guidance = `Context:\nMilestones: ${milestoneText}\nExtracurriculars: ${extracurricularsText || 'None shared'}\nStudent said: "${userInput}"`;

        const messages = [
            { role: 'system', content: COUNSELOR_PROMPT },
            ...recentHistory,
            { role: 'user', content: guidance }
        ];

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            max_tokens: 160,
            temperature: 0.3,
            stream: false
        });

        const aiResponse = response.choices[0].message.content;
        
        // Store conversation
        session.conversationHistory.push({ role: 'user', content: userInput });
        session.conversationHistory.push({ role: 'assistant', content: aiResponse });

        return aiResponse;
    } catch (error) {
        console.error('Error getting intermediate response:', error);
        return "Is preparing for college applications one of your goals?";
    }
}

// Streaming versions of conversation functions
async function getMilestoneConversationStream(sessionId, userInput, isFirstQuestion = false, sendSSE) {
    try {
        const session = await getSession(sessionId);
        if (!session) throw new Error('Session not found');

        let specificPrompt;
        
        if (isFirstQuestion) {
            const schoolInfo = session.studentHighschool ? ` attending ${session.studentHighschool}` : '';
            specificPrompt = `This is the first conversation with ${session.studentName}, age ${session.studentAge}, from ${session.studentLocation}${schoolInfo}. Start the milestone identification conversation naturally by greeting them warmly and asking the exact question about their 2-5 year goals.`;
        } else {
            // Classify milestone goals from their response (conversation-only)
            const extractedGoals = await classifyMilestoneGoals(userInput);
            console.log('Extracted goals from "' + userInput + '":', extractedGoals);
            
            if (extractedGoals.length > 0) {
                // Store the identified milestones
                session.identifiedMilestones = extractedGoals;
                
                // Create human-readable goal names for the response
                const goalNames = extractedGoals.map(goal => {
                    return goal.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
                });
                
                const goalList = goalNames.length === 1 ? goalNames[0] : 
                               goalNames.length === 2 ? `${goalNames[0]} and ${goalNames[1]}` :
                               `${goalNames.slice(0, -1).join(', ')}, and ${goalNames[goalNames.length - 1]}`;
                
                const response = `Great! I can see you're focused on ${goalList}. Would you like to share some of your extracurricular activities and experiences that relate to these goals? This will help me give you more targeted advice.`;
                
                // Store conversation and transition to extracurricular question
                session.conversationHistory.push({ role: 'user', content: userInput });
                session.conversationHistory.push({ role: 'assistant', content: response });
                session.phase = 'extracurricular_question';
                
                // Stream the response word by word
                streamResponseSSE(sendSSE, response);
                return response;
            } else {
                console.log('No goals extracted, continuing milestone identification');
                specificPrompt = `Continue the milestone identification conversation. The student just said: "${userInput}". They haven't clearly stated their goals yet, so ask a follow-up question to help them clarify their 2-5 year aspirations.`;
            }
        }

        const messages = [
            { role: 'system', content: MILESTONE_IDENTIFICATION_PROMPT },
            { role: 'user', content: specificPrompt }
        ];

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            max_tokens: 250,
            temperature: 0.3,
            stream: true // Enable streaming
        });

        let aiResponse = '';
        
        // Process streaming response
        for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                aiResponse += content;
                // Send each chunk to the client
                sendSSE({
                    type: 'content',
                    content: content
                });
            }
        }
        
        // Store conversation
        if (!isFirstQuestion) {
            session.conversationHistory.push({ role: 'user', content: userInput });
        }
        session.conversationHistory.push({ role: 'assistant', content: aiResponse });

        return aiResponse;
    } catch (error) {
        console.error('Error getting milestone streaming response:', error);
        const fallback = "What are your biggest goals for the next few years?";
        streamResponseSSE(sendSSE, fallback);
        return fallback;
    }
}

async function getIntermediateConversationStream(sessionId, userInput, sendSSE) {
    try {
        const session = await getSession(sessionId);
        if (!session) throw new Error('Session not found');

        const milestoneGoals = session.identifiedMilestones || [];
        const extracurriculars = session.extracurriculars || [];

        const milestoneText = milestoneGoals.map(goal => goal.replace(/_/g, ' ')).join(', ') || 'a competitive university';
        const extracurricularsText = extracurriculars.map(ec => `${ec.title}: ${ec.description}`).join('; ');

        // Provide conversation history for context
        const recentHistory = session.conversationHistory.slice(-8);

        const guidance = `Context:\nMilestones: ${milestoneText}\nExtracurriculars: ${extracurricularsText || 'None shared'}\nStudent said: "${userInput}"`;

        const messages = [
            { role: 'system', content: COUNSELOR_PROMPT },
            ...recentHistory,
            { role: 'user', content: guidance }
        ];

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            max_tokens: 160,
            temperature: 0.3,
            stream: true
        });

        let aiResponse = '';
        
        // Process streaming response
        for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                aiResponse += content;
                // Send each chunk to the client
                sendSSE({
                    type: 'content',
                    content: content
                });
            }
        }
        
        // Store conversation
        session.conversationHistory.push({ role: 'user', content: userInput });
        session.conversationHistory.push({ role: 'assistant', content: aiResponse });

        return aiResponse;
    } catch (error) {
        console.error('Error getting intermediate streaming response:', error);
        const fallback = "Is preparing for college applications one of your goals?";
        streamResponseSSE(sendSSE, fallback);
        return fallback;
    }
}

// Helper function to stream a pre-formed response
function streamResponse(res, text) {
    const words = text.split(' ');
    for (let i = 0; i < words.length; i++) {
        const content = (i === 0) ? words[i] : ' ' + words[i];
        res.write(`data: ${JSON.stringify({
            type: 'content',
            content: content
        })}\n\n`);
    }
}

// Helper function to stream a pre-formed response using SSE callback
function streamResponseSSE(sendSSE, text) {
    const words = text.split(' ');
    for (let i = 0; i < words.length; i++) {
        const content = (i === 0) ? words[i] : ' ' + words[i];
        sendSSE({
            type: 'content',
            content: content
        });
    }
}

// Routes

// Test endpoint to verify server is running
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Server is running!', 
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development',
        openai_configured: !!openai,
        supabase_configured: !!supabase,
        port: process.env.PORT || 3001
    });
});

// Legacy interview endpoint - redirects to new goal-centric system
app.post('/api/start-interview', async (req, res) => {
    try {
        const { name, email } = req.body;
        
        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' });
        }

        // Create student in database
        const { data, error } = await supabase
            .from('students')
            .insert([{ 
                name: name, 
                email: email, 
                exploration_openness: 'medium' 
            }])
            .select();

        if (error) throw error;

        const studentId = data[0].id;
        
        // Create simplified session for goal conversation
        const sessionId = Date.now().toString();
        const session = {
            studentId,
            studentName: name,
            studentEmail: email,
            conversationHistory: [],
            identifiedMilestones: [],
            extracurriculars: [],
            phase: 'milestone_identification'
        };

        activeSessions.set(sessionId, session);

        // Get first milestone question
        const firstResponse = await getMilestoneConversation(sessionId, "", true);
        
        res.json({
            sessionId,
            studentId,
            message: firstResponse,
            phase: 'milestone_identification'
        });

    } catch (error) {
        console.error('Error starting interview:', error);
        res.status(500).json({ error: 'Failed to start interview' });
    }
});

// Add new endpoint for student basic info form submission
app.post('/api/submit-basic-info', async (req, res) => {
    try {
        const { name, age, location, highschool, gpa, satAct } = req.body;
        
        if (!name || !age || !location) {
            return res.status(400).json({ error: 'Name, age, and location are required' });
        }

        // Create student with basic info (matching updated database schema)
        const { data, error } = await supabase
            .from('students')
            .insert([{ 
                name: name, 
                email: `${name.toLowerCase().replace(/\s+/g, '.')}@student.temp`, // Temporary email
                age: age,
                location: location,
                highschool: highschool || null,
                gpa: gpa ? parseFloat(gpa) : null,
                satscore: satAct || null,
                exploration_openness: 'medium'
            }])
            .select();

        if (error) throw error;

        const studentId = data[0].id;
        
        // Create simplified session for goal conversation
        const sessionId = Date.now().toString();
        const session = {
            studentId,
            studentName: name,
            studentAge: age,
            studentLocation: location,
            studentHighschool: highschool,
            studentGpa: gpa,
            studentSatAct: satAct,
            conversationHistory: [],
            identifiedMilestones: [],
            extracurriculars: [],
            phase: 'milestone_identification'
        };

        activeSessions.set(sessionId, session);

        // Get first milestone question
        const firstResponse = await getMilestoneConversation(sessionId, "", true);
        
        res.json({
            sessionId,
            studentId,
            message: firstResponse,
            phase: 'milestone_identification'
        });

    } catch (error) {
        console.error('Error submitting basic info:', error);
        res.status(500).json({ error: 'Failed to submit basic information' });
    }
});

// Handle extracurricular question response (Yes/No)
app.post('/api/extracurricular-response', async (req, res) => {
    // Check if required services are configured
    if (!supabase) {
        return res.status(500).json({ error: 'Supabase service not configured' });
    }
    try {
        const { sessionId, response } = req.body;
        
        if (!sessionId || !response) {
            return res.status(400).json({ error: 'Session ID and response are required' });
        }

        const session = await getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (response === 'yes') {
            // User wants to add extracurriculars
            session.phase = 'extracurricular_collection';
            
            const message = "Perfect! Please add your extracurricular activities one at a time. For each activity, provide a title and description.";
            
            session.conversationHistory.push({ role: 'user', content: 'Yes, I\'d like to share my extracurriculars' });
            session.conversationHistory.push({ role: 'assistant', content: message });
            
            res.json({
                message,
                phase: 'extracurricular_collection',
                identifiedMilestones: session.identifiedMilestones
            });
        } else {
            // User doesn't want to add extracurriculars, move to intermediate goals
            session.phase = 'intermediate_goals';
            
            const nextResponse = await getIntermediateConversation(sessionId, "Starting intermediate goals conversation without extracurriculars");
            
            session.conversationHistory.push({ role: 'user', content: 'No, I\'d prefer to skip extracurriculars for now' });
            
            res.json({
                message: nextResponse,
                phase: 'intermediate_goals',
                identifiedMilestones: session.identifiedMilestones
            });
        }

    } catch (error) {
        console.error('Error handling extracurricular response:', error);
        res.status(500).json({ error: 'Failed to process response' });
    }
});

// New route for submitting individual extracurriculars
app.post('/api/submit-extracurricular', async (req, res) => {
    // Check if required services are configured
    if (!supabase) {
        return res.status(500).json({ error: 'Supabase service not configured' });
    }
    try {
        console.log('Received extracurricular submission:', req.body);
        const { sessionId, title, description } = req.body;
        
        if (!sessionId || !title || !description) {
            console.log('Missing required fields:', { sessionId: !!sessionId, title: !!title, description: !!description });
            return res.status(400).json({ error: 'Session ID, title, and description are required' });
        }

        const session = await getSession(sessionId);
        if (!session) {
            console.log('Session not found:', sessionId);
            return res.status(404).json({ error: 'Session not found' });
        }

        console.log('Session found, student ID:', session.studentId);

        // Store extracurricular
        if (!session.extracurriculars) {
            session.extracurriculars = [];
        }
        
        session.extracurriculars.push({
            title: title.trim(),
            description: description.trim(),
            timestamp: new Date().toISOString()
        });

        // Save to database
        try {
            // Make category_name unique by adding timestamp
            const uniqueCategoryName = `${title.trim()}_${Date.now()}`;
            
            console.log('Attempting to save to database:', {
                student_id: session.studentId,
                category_name: uniqueCategoryName,
                title: title.trim()
            });
            
            const { data, error } = await supabase
                .from('extracurriculars')
                .insert({
                    student_id: session.studentId,
                    category_name: uniqueCategoryName,
                    description: description.trim(),
                    title: title.trim()
                });
            
            if (error) {
                console.error('Database insert error:', error);
            } else {
                console.log('Successfully saved to database:', data);
            }
        } catch (dbError) {
            console.error('Error saving extracurricular to database:', dbError);
            // Continue even if database save fails
        }

        console.log('Extracurricular successfully added to session. Total count:', session.extracurriculars.length);
        
        res.json({
            success: true,
            message: 'Extracurricular added successfully',
            totalCount: session.extracurriculars.length
        });

    } catch (error) {
        console.error('Error submitting extracurricular:', error);
        res.status(500).json({ error: 'Failed to submit extracurricular', details: error.message });
    }
});

// Finish adding extracurriculars and move to intermediate goals
app.post('/api/finish-extracurriculars', async (req, res) => {
    // Check if required services are configured
    if (!openai || !supabase) {
        return res.status(500).json({ error: 'Required services not configured' });
    }
    try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        const session = await getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Transition to intermediate goals
        session.phase = 'intermediate_goals';

        const nextResponse = await getIntermediateConversation(sessionId, "Starting intermediate goals conversation with extracurriculars");
        
        // Add simple thank you message
        const thankYouMessage = `Thanks for sharing! Let's identify some specific next steps to strengthen your profile.`;
        
        session.conversationHistory.push({ role: 'assistant', content: thankYouMessage });
        session.conversationHistory.push({ role: 'assistant', content: nextResponse });
        
        res.json({
            message: `${thankYouMessage}\n\n${nextResponse}`,
            phase: 'intermediate_goals',
            identifiedMilestones: session.identifiedMilestones
        });

    } catch (error) {
        console.error('Error finishing extracurriculars:', error);
        res.status(500).json({ error: 'Failed to finish extracurriculars' });
    }
});

// Legacy route for submitting extracurriculars with categories (kept for compatibility)
app.post('/api/submit-extracurriculars', async (req, res) => {
    try {
        const { sessionId, extracurriculars } = req.body;
        
        if (!sessionId || !extracurriculars) {
            return res.status(400).json({ error: 'Session ID and extracurriculars are required' });
        }

        const session = await getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Store extracurriculars in session
        session.extracurriculars = extracurriculars;

        // No extraction here; database persistence for legacy payload kept minimal

        // Transition to intermediate goals phase
        session.phase = 'intermediate_goals';

        // Get first intermediate goal question
        const nextResponse = await getIntermediateConversation(sessionId, "Starting intermediate goals conversation");
        
        res.json({
            message: nextResponse,
            phase: 'intermediate_goals',
            identifiedMilestones: session.identifiedMilestones
        });

    } catch (error) {
        console.error('Error submitting extracurriculars:', error);
        res.status(500).json({ error: 'Failed to submit extracurriculars' });
    }
});

// Legacy endpoint - redirects to new system
app.post('/api/send-message', async (req, res) => {
    try {
        const { sessionId, message } = req.body;
        
        if (!sessionId || !message) {
            return res.status(400).json({ error: 'Session ID and message are required' });
        }

        const session = await getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        let response;
        
        if (session.phase === 'milestone_identification') {
            response = await getMilestoneConversation(sessionId, message, false);
        } else if (session.phase === 'intermediate_goals') {
            response = await getIntermediateConversation(sessionId, message);
        } else {
            response = "I'm not sure what phase of the conversation we're in. Can you tell me about your goals?";
        }

        res.json({
            message: response,
            phase: session.phase,
            identifiedMilestones: session.identifiedMilestones || []
        });

    } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).json({ error: 'Failed to process message' });
    }
});

// Main message endpoint for the new conversation flow
app.post('/api/send-message-new', async (req, res) => {
    try {
        const { sessionId, message } = req.body;
        
        if (!sessionId || !message) {
            return res.status(400).json({ error: 'Session ID and message are required' });
        }

        const session = await getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        let response;
        
        if (session.phase === 'milestone_identification') {
            response = await getMilestoneConversation(sessionId, message, false);
        } else if (session.phase === 'intermediate_goals') {
            response = await getIntermediateConversation(sessionId, message);
        } else {
            response = "I'm not sure what phase of the conversation we're in. Can you tell me about your goals?";
        }

        res.json({
            message: response,
            phase: session.phase,
            identifiedMilestones: session.identifiedMilestones || [],
            sessionInfo: {
                studentName: session.studentName,
                conversationLength: session.conversationHistory.length
            }
        });

    } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).json({ error: 'Failed to process message' });
    }
});

// Streaming message endpoint using Server-Sent Events
app.post('/api/send-message-stream', async (req, res) => {
    // Check if required services are configured
    if (!openai) {
        return res.status(500).json({ error: 'OpenAI service not configured' });
    }
    if (!supabase) {
        return res.status(500).json({ error: 'Supabase service not configured' });
    }
    try {
        const { sessionId, message } = req.body;
        
        if (!sessionId || !message) {
            return res.status(400).json({ error: 'Session ID and message are required' });
        }

        const session = await getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Set up Server-Sent Events with proper headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control, Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        });

        // Send initial message data
        const sendSSE = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        sendSSE({
            type: 'start',
            phase: session.phase,
            identifiedMilestones: session.identifiedMilestones || [],
            sessionInfo: {
                studentName: session.studentName,
                conversationLength: session.conversationHistory.length
            }
        });

        // Get streaming response
        let response;
        
        if (session.phase === 'milestone_identification') {
            response = await getMilestoneConversationStream(sessionId, message, false, sendSSE);
        } else if (session.phase === 'intermediate_goals') {
            response = await getIntermediateConversationStream(sessionId, message, sendSSE);
        } else {
            // Send non-streaming fallback
            const fallbackResponse = "I'm not sure what phase of the conversation we're in. Can you tell me about your goals?";
            sendSSE({
                type: 'content',
                content: fallbackResponse
            });
            response = fallbackResponse;
        }

        // Send completion message
        sendSSE({
            type: 'complete',
            message: response,
            phase: session.phase,
            identifiedMilestones: session.identifiedMilestones || []
        });

        res.end();

    } catch (error) {
        console.error('Error processing streaming message:', error);
        try {
            res.write(`data: ${JSON.stringify({
                type: 'error',
                error: 'Failed to process message'
            })}\n\n`);
        } catch (writeError) {
            console.error('Error writing error response:', writeError);
        }
        res.end();
    }
});

// Removed outdated transition helper; flow is explicit via endpoints

// Get identified milestone goals for extracurricular form
app.get('/api/milestone-goals/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    // Convert milestone goals to human-readable format for the form
    const milestoneGoals = (session.identifiedMilestones || []).map(goal => ({
        value: goal,
        label: goal.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }));

    res.json({
        milestoneGoals,
        phase: session.phase,
        studentName: session.studentName
    });
});

// Get conversation status
app.get('/api/status/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
        status: getConversationStatus(sessionId),
        session: {
            studentName: session.studentName,
            totalQuestionsAsked: session.totalQuestionsAsked
        }
    });
});

// Get student data for summary
app.get('/api/get-student-data/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await getSession(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const studentData = {
            student_info: {
                name: session.studentName,
                age: session.studentAge,
                location: session.studentLocation,
                highschool: session.studentHighschool,
                gpa: session.studentGpa,
                sat_act: session.studentSatAct
            },
            identified_milestones: session.identifiedMilestones || [],
            extracurriculars: session.extracurriculars || [],
            conversation_length: session.conversationHistory.length,
            phase: session.phase,
            conversation_history: session.conversationHistory || []
        };

        res.json(studentData);

    } catch (error) {
        console.error('Error getting student data:', error);
        res.status(500).json({ error: 'Failed to get student data' });
    }
});

// Generate comprehensive summary endpoint
app.post('/api/generate-summary/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await getSession(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        console.log('🔍 Generating summary for session:', sessionId);

        // Import the data extraction functions
        const { extractComprehensiveData, saveComprehensiveData, getComprehensiveStudentData } = require('./dataExtraction');

        // Extract comprehensive data from conversation
        const extractedData = await extractComprehensiveData(session.conversationHistory, {
            studentName: session.studentName,
            studentId: session.studentId,
            phase: session.phase
        });

        // Save extracted data to database if any was found
        if (extractedData && session.studentId) {
            await saveComprehensiveData(session.studentId, extractedData);
            console.log('✅ Extracted data saved to database');
        }

        // Get comprehensive student data from database
        const comprehensiveData = await getComprehensiveStudentData(session.studentId);

        // Combine session data with database data
        const fullData = {
            student_info: {
                name: session.studentName,
                age: session.studentAge,
                location: session.studentLocation,
                highschool: session.studentHighschool,
                gpa: session.studentGpa,
                sat_act: session.studentSatAct
            },
            identified_milestones: session.identifiedMilestones || [],
            extracurriculars: session.extracurriculars || [],
            conversation_length: session.conversationHistory.length,
            phase: session.phase,
            conversation_history: session.conversationHistory || [],
            // Add database data
            milestone_goals: comprehensiveData?.milestone_goals || [],
            intermediate_milestones: comprehensiveData?.intermediate_milestones || [],
            skills: comprehensiveData?.skills || [],
            sectors: comprehensiveData?.sectors || [],
            database_extracurriculars: comprehensiveData?.extracurriculars || [],
            extracted_data_history: session.extractedDataHistory || []
        };

        console.log('✅ Summary generated successfully');

        res.json({
            success: true,
            summary: 'Comprehensive data extraction completed',
            comprehensiveData: fullData,
            extractedData: extractedData
        });

    } catch (error) {
        console.error('Error generating summary:', error);
        res.status(500).json({ error: 'Failed to generate summary', details: error.message });
    }
});

// Extract data to file
// Removed server-side extraction; handled elsewhere via dedicated script

// New comprehensive summary extraction endpoint
// Removed server-side summary generation; extraction handled by external script/button

// Helper functions (conversation status only)

function getConversationStatus(sessionId) {
    const session = activeSessions.get(sessionId);
    if (!session) return null;
    
    return {
        phase: session.phase,
        identifiedMilestones: session.identifiedMilestones?.length || 0,
        conversationLength: session.conversationHistory.length,
        studentName: session.studentName
    };
}

// Legacy functions removed - now purely conversation management

// Catch-all handler: send back React's index.html file for non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/build/index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 UltraIntelligence API server running on port ${PORT}`);
    console.log(`📱 Frontend should connect to: http://localhost:${PORT}`);
});

// Export for Vercel
module.exports = app;

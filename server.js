const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const { 
    extractComprehensiveData, 
    saveComprehensiveData, 
    getComprehensiveStudentData,
    extractStudentDataToFile 
} = require('./dataExtraction');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Simplified categories - focusing on the two main goal types
const GOAL_CATEGORIES = [
    'MILESTONE_GOALS',      // 2-5 year goals
    'INTERMEDIATE_MILESTONES' // 3 months - 2 year stepping stones
];

// Store active sessions (in production, use Redis or database)
const activeSessions = new Map();

// Removed old complex conversation system - using simplified approach

// ================================================================================================
// CONVERSATION SYSTEM PROMPTS (Focused only on conversation, not extraction)
// ================================================================================================

// Milestone identification prompt - focused on conversation flow
const MILESTONE_IDENTIFICATION_PROMPT = `
You are an AI counselor helping students identify their long-term goals. Be direct and focused.

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

Focus on being efficient and moving the conversation forward quickly.`;

// Strategic counseling system - focused on natural conversation
const INTERMEDIATE_MILESTONE_PROMPT = `
You are a strategic college counselor with expertise in guiding high-achieving students toward elite university admission. Your role is to naturally guide students through strategic planning conversations that identify actionable next steps.

CORE APPROACH: Offer valuable opportunities and insights rather than interrogating about current status. Be conversational, helpful, and strategic.

STRATEGIC AREAS TO EXPLORE (keep these in mind but don't explicitly reference):

1. APPLICATION STRATEGY: Essay development, recommendation cultivation, interview prep, early decision strategy
2. ACADEMIC POSITIONING: Test score optimization, course rigor, summer programs, academic competitions
3. RESEARCH ADVANCEMENT: Independent projects, publication opportunities, conference presentations, lab leadership
4. PROFESSIONAL DEVELOPMENT: Industry connections, mentorship, internship progression, job shadowing
5. LEADERSHIP BUILDING: Club founding, officer positions, community initiatives, social impact projects
6. COMPETITION EXCELLENCE: Science olympiad, math contests, debate, hackathons, research competitions

CONVERSATION STYLE:
- Be natural and conversational, not mechanical
- Offer specific opportunities and suggestions
- Use "Would you be interested in..." instead of "Have you..."
- Acknowledge their responses before pivoting
- Provide concrete value and actionable ideas
- Connect suggestions to their specific goals naturally

DESIRABLE CONVERSATION EXAMPLES:

GOOD APPROACHES:

Example 1 - Application Focus:
Student: "I want to work on my university applications."
Counselor: "That's smart timing! For someone with your research background, I'd recommend focusing on crafting a compelling narrative that connects your AI and nanomedicine work. Would you be interested in exploring some essay strategies that could help you stand out to admissions committees at top universities?"

Example 2 - Research Advancement:
Student: "I'm working on research with my boss."
Counselor: "That's fantastic that you're already co-authoring! Since you mentioned wanting to write your own research, there are some strategic ways to develop independent projects that could really strengthen your profile. Would you be interested in discussing how to identify research gaps you could explore on your own?"

Example 3 - Leadership Development:
Student: "I want to start a club related to CS/bio."
Counselor: "A CS/bio club is a brilliant idea - that intersection is exactly what top universities are looking for. I know some specific approaches for launching clubs that actually make an impact and catch admissions attention. Would you be interested in hearing about strategies that go beyond just 'starting another club'?"

Example 4 - Strategic Pivoting:
Student: "I haven't started planning yet. I want to work on applications."
Counselor: "Absolutely, applications should be the priority right now. Since you have such unique research experience, there are some essay approaches that could really differentiate you from other applicants. Would you be interested in discussing how to craft a narrative that showcases your interdisciplinary thinking?"

AVOID THESE PATTERNS:
- "Since we've discussed X, let's focus on Y milestone..."
- "Have you started/considered/looked into..."
- Explicitly referencing milestone categories
- Generic transitions without acknowledgment
- Mechanical checklist approach

STRATEGIC CONVERSATION PATTERNS:

PATTERN 1 - ACKNOWLEDGE + BUILD + OFFER:
"[Specific acknowledgment of their response] + [Strategic insight based on their profile] + Would you be interested in [specific opportunity]?"

PATTERN 2 - VALIDATE + PIVOT + VALUE:
"[Validate their priority] + [Connect to their unique strengths] + Would you like to explore [concrete next step]?"

PATTERN 3 - EXPERTISE + OPPORTUNITY:
"[Show understanding of their field/interests] + [Specific strategic opportunity] + Would you be interested in [actionable approach]?"

RESPONSE QUALITY CHECKLIST:
✓ Acknowledges their specific response (not generic)
✓ Offers concrete value or insight
✓ Uses "Would you be interested in..." phrasing
✓ Connects to their top university goal naturally
✓ Provides specific, actionable suggestions
✓ Feels conversational, not mechanical
✗ Avoids milestone terminology
✗ Avoids "Have you..." questions
✗ Avoids generic transitions

STRATEGIC FOCUS AREAS (keep in mind but don't mention explicitly):
- Essay narrative development and storytelling
- Research independence and publication pathways
- Leadership impact and club founding strategies
- Competition participation and achievement
- Professional network building and mentorship
- Academic positioning and course optimization

Remember: You're an expert counselor offering insider knowledge and strategic opportunities. Every response should feel valuable and make the student think "I hadn't considered that approach before."`;

// Improved milestone goal extraction function
async function extractMilestoneGoals(userInput) {
    try {
        const extractionPrompt = `
Analyze this student response about their 2-5 year goals and identify the most relevant milestone goals.

Student Response: "${userInput}"

Look for mentions of:
- Specific universities (MIT, Stanford, Harvard, etc.) 
- Career fields (engineering, medicine, business, etc.)
- Entrepreneurship/startup aspirations
- Graduate school plans
- Professional goals

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

Return JSON array of 1-3 most relevant goals: ["goal1", "goal2", "goal3"]
If unclear, return empty array: []
`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a goal extraction AI. Return only valid JSON arrays with milestone goal names.' },
                { role: 'user', content: extractionPrompt }
            ],
            max_tokens: 150,
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
        console.error('Error extracting milestone goals:', error);
        return [];
    }
}

// New conversation functions
async function getMilestoneConversation(sessionId, userInput, isFirstQuestion = false) {
    try {
        const session = activeSessions.get(sessionId);
        if (!session) throw new Error('Session not found');

        let specificPrompt;
        
        if (isFirstQuestion) {
            const schoolInfo = session.studentHighschool ? ` attending ${session.studentHighschool}` : '';
            specificPrompt = `This is the first conversation with ${session.studentName}, age ${session.studentAge}, from ${session.studentLocation}${schoolInfo}. Start the milestone identification conversation naturally by greeting them warmly and asking the exact question about their 2-5 year goals.`;
        } else {
            // Extract milestone goals from their response
            const extractedGoals = await extractMilestoneGoals(userInput);
            
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
            max_tokens: 200,
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
        const session = activeSessions.get(sessionId);
        if (!session) throw new Error('Session not found');

        const milestoneGoals = session.identifiedMilestones || [];
        const extracurriculars = session.extracurriculars || [];
        
        // Format milestone goals for the prompt
        const goalsList = milestoneGoals.map(goal => goal.replace(/_/g, ' ')).join(', ');
        
        // Format extracurriculars for the prompt
        const extracurricularsList = extracurriculars
            .map(ec => `${ec.title}: ${ec.description}`)
            .join('; ');
        
        // Format conversation history for context
        const recentHistory = session.conversationHistory.slice(-8); // Last 8 messages for context
        const historyText = recentHistory.length > 0 ? 
            `\nRECENT CONVERSATION:\n${recentHistory.map(msg => `${msg.role === 'user' ? 'Student' : 'Counselor'}: ${msg.content}`).join('\n')}\n` : 
            '\nRECENT CONVERSATION: [This is the start of intermediate planning]\n';

        console.log('Conversation history for AI:', historyText);

        let specificPrompt;
        
        if (userInput === "Starting intermediate goals conversation" || userInput === "Starting intermediate goals conversation with extracurriculars" || userInput === "Starting intermediate goals conversation without extracurriculars") {
            specificPrompt = `STUDENT CONTEXT:
- Goal: ${goalsList}
- Background: ${extracurricularsList}

CONVERSATION STARTER: This student wants to get into top universities and has shared their activities. Now offer them something valuable and specific.

EXAMPLE APPROACHES:
- "With your research experience, I think you could really strengthen your profile by [specific suggestion]. Would you be interested in exploring [specific opportunity]?"
- "Given your background in [their area], there's a strategic move that could set you apart from other applicants. Would you like to hear about [specific strategy]?"

INSTRUCTIONS:
1. Acknowledge their impressive background briefly
2. Offer ONE specific, valuable opportunity or strategy
3. Ask if they'd be interested in exploring it
4. Be conversational and helpful, not mechanical

Choose the most impactful area to focus on first based on their profile.${historyText}`;
        } else {
            specificPrompt = `STUDENT CONTEXT:
- Goal: ${goalsList}
- Background: ${extracurricularsList}
- Their response: "${userInput}"

CONVERSATION FLOW:
1. Acknowledge their response genuinely (don't just say "great" - be specific)
2. Offer a NEW valuable opportunity or insight (different from what was just discussed)
3. Ask "Would you be interested in..." not "Have you..."

STRATEGIC AREAS TO EXPLORE (choose one NOT yet discussed):
- Application essay strategy and narrative development
- Research publication and presentation opportunities  
- Leadership roles and club founding
- Academic competition participation
- Professional networking and mentorship
- Summer program applications
- Test score optimization strategies

EXAMPLE GOOD RESPONSES:
"That makes perfect sense - applications are definitely the priority right now. Since you have such strong research experience, I think there are some essay approaches that could really make your application stand out. Would you be interested in discussing strategies for crafting a compelling narrative around your AI and nanomedicine work?"

BE NATURAL, HELPFUL, AND SPECIFIC. Avoid mentioning "milestones" explicitly.${historyText}`;
        }

        const messages = [
            { role: 'system', content: INTERMEDIATE_MILESTONE_PROMPT },
            { role: 'user', content: specificPrompt }
        ];

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            max_tokens: 150,
            temperature: 0.05
        });

        const aiResponse = response.choices[0].message.content;
        
        // Store conversation (but not if it's the initial prompt)
        if (!userInput.startsWith("Starting intermediate goals conversation")) {
            session.conversationHistory.push({ role: 'user', content: userInput });
        }
        session.conversationHistory.push({ role: 'assistant', content: aiResponse });

        // Note: Data extraction is now handled separately via the summary endpoint

        return aiResponse;
    } catch (error) {
        console.error('Error getting intermediate response:', error);
        return "What specific steps are you taking this year to work toward your goals?";
    }
}

// Routes

// Start a new interview session
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
        
        // Create session
        const sessionId = Date.now().toString();
        const session = {
            studentId,
            studentName: name,
            studentEmail: email,
            currentCategoryIndex: 0,
            questionsInCategory: 0,
            totalQuestionsAsked: 0,
            conversationHistory: [],
            categoryResponses: {
                MILESTONE_GOALS: [],
                INTERMEDIATE_MILESTONES: [],
                SECTORS: [],
                SKILLS: []
            },
            extractedDataHistory: []
        };

        activeSessions.set(sessionId, session);

        // Get first question
        const firstResponse = await getConversationResponse(sessionId, "", true);
        
        res.json({
            sessionId,
            studentId,
            message: firstResponse,
            status: getConversationStatus(sessionId)
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
            extractedDataHistory: [],
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
    try {
        const { sessionId, response } = req.body;
        
        if (!sessionId || !response) {
            return res.status(400).json({ error: 'Session ID and response are required' });
        }

        const session = activeSessions.get(sessionId);
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
    try {
        console.log('Received extracurricular submission:', req.body);
        const { sessionId, title, description } = req.body;
        
        if (!sessionId || !title || !description) {
            console.log('Missing required fields:', { sessionId: !!sessionId, title: !!title, description: !!description });
            return res.status(400).json({ error: 'Session ID, title, and description are required' });
        }

        const session = activeSessions.get(sessionId);
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
    try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        const session = activeSessions.get(sessionId);
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

        const session = activeSessions.get(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Store extracurriculars in session
        session.extracurriculars = extracurriculars;

        // Save extracurriculars to database
        try {
            for (const [category, activities] of Object.entries(extracurriculars)) {
                if (activities && activities.length > 0) {
                    const description = Array.isArray(activities) ? activities.join('; ') : activities.toString();
                    
                    await supabase
                        .from('extracurriculars')
                        .upsert({
                            student_id: session.studentId,
                            category_name: category,
                            description: description,
                            title: category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                        }, { onConflict: 'student_id,category_name' });
                }
            }
        } catch (dbError) {
            console.error('Error saving extracurriculars to database:', dbError);
            // Continue even if database save fails
        }

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

// Send message and get response
app.post('/api/send-message', async (req, res) => {
    try {
        const { sessionId, message } = req.body;
        
        if (!sessionId || !message) {
            return res.status(400).json({ error: 'Session ID and message are required' });
        }

        const session = activeSessions.get(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Get conversation response
        const conversationResponse = await getConversationResponse(sessionId, message, false);
        
        // Note: Data extraction is now handled separately via the summary endpoint

        res.json({
            message: conversationResponse,
            status: getConversationStatus(sessionId),
            extractedData
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

        const session = activeSessions.get(sessionId);
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

function shouldTransitionToExtracurriculars(session, message) {
    // Simple logic - after 2-3 exchanges about goals, transition
    const goalConversationLength = session.conversationHistory.filter(msg => msg.role === 'user').length;
    return goalConversationLength >= 2;
}

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
        const session = activeSessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Get comprehensive data from database using the new extraction service
        const comprehensiveData = await getComprehensiveStudentData(session.studentId);

        console.log('Database query results:');
        console.log('Milestone goals:', comprehensiveData?.milestone_goals?.length || 0);
        console.log('Intermediate milestones:', comprehensiveData?.intermediate_milestones?.length || 0);
        console.log('Skills:', comprehensiveData?.skills?.length || 0);
        console.log('Sectors:', comprehensiveData?.sectors?.length || 0);
        console.log('Extracurriculars:', comprehensiveData?.extracurriculars?.length || 0);

        const studentData = {
            student_info: {
                name: session.studentName,
                age: session.studentAge,
                location: session.studentLocation,
                highschool: session.studentHighschool,
                gpa: session.studentGpa,
                sat_act: session.studentSatAct,
                database_info: comprehensiveData?.student_info || null
            },
            identified_milestones: session.identifiedMilestones || [],
            extracurriculars: session.extracurriculars || [],
            comprehensive_database_data: comprehensiveData,
            conversation_length: session.conversationHistory.length,
            phase: session.phase,
            conversation_history: session.conversationHistory || [],
            extracted_data_history: session.extractedDataHistory || []
        };

        res.json(studentData);

    } catch (error) {
        console.error('Error getting student data:', error);
        res.status(500).json({ error: 'Failed to get student data' });
    }
});

// Extract data to file
app.post('/api/extract-data/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = activeSessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const filepath = await extractStudentDataToFile(session);
        
        res.json({
            success: true,
            filepath,
            message: 'Data extracted successfully'
        });

    } catch (error) {
        console.error('Error extracting data:', error);
        res.status(500).json({ error: 'Failed to extract data' });
    }
});

// New comprehensive summary extraction endpoint
app.post('/api/generate-summary/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = activeSessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        console.log('🔄 Starting comprehensive data extraction for summary...');
        
        // Extract comprehensive data from conversation history
        const sessionInfo = {
            studentName: session.studentName,
            studentAge: session.studentAge,
            studentLocation: session.studentLocation,
            studentHighschool: session.studentHighschool
        };
        
        const extractedData = await extractComprehensiveData(
            session.conversationHistory, 
            sessionInfo
        );
        
        if (!extractedData) {
            return res.status(500).json({ error: 'Failed to extract comprehensive data' });
        }
        
        // Save comprehensive data to database
        const saveSuccess = await saveComprehensiveData(
            session.studentId, 
            extractedData, 
            sessionInfo
        );
        
        if (!saveSuccess) {
            return res.status(500).json({ error: 'Failed to save comprehensive data' });
        }
        
        // Extract to file for backup
        const filepath = await extractStudentDataToFile(session);
        
        // Get final comprehensive data for response
        const finalData = await getComprehensiveStudentData(session.studentId);
        
        res.json({
            success: true,
            message: 'Comprehensive summary generated successfully',
            extractedData,
            comprehensiveData: finalData,
            filepath,
            summary: {
                milestone_goals_count: extractedData.milestone_goals?.length || 0,
                intermediate_milestones_count: extractedData.intermediate_milestones?.length || 0,
                skills_count: extractedData.skills?.length || 0,
                sectors_count: extractedData.sectors?.length || 0,
                conversation_length: session.conversationHistory.length
            }
        });

    } catch (error) {
        console.error('❌ Error generating comprehensive summary:', error);
        res.status(500).json({ 
            error: 'Failed to generate comprehensive summary',
            details: error.message 
        });
    }
});

// Helper functions (adapted from index.js)

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

async function getConversationResponse(sessionId, userInput, isFirstQuestion = false) {
    try {
        const session = activeSessions.get(sessionId);
        if (!session) throw new Error('Session not found');

        const status = getConversationStatus(sessionId);
        
        if (status.isComplete) {
            return "Interview complete! You've shared amazing insights about your goals. Your data has been saved.";
        }

        let specificPrompt;
        
        // Format conversation history for context
        const recentHistory = session.conversationHistory.slice(-10);
        const historyText = recentHistory.length > 0 ? 
            `\nCONVERSATION HISTORY:\n${recentHistory.map(msg => `${msg.role === 'user' ? 'Student' : 'Counselor'}: ${msg.content}`).join('\n')}\n` : 
            '\nCONVERSATION HISTORY: [This is the start of the conversation]\n';
        
        if (isFirstQuestion) {
            specificPrompt = `This is question 1 of 16 in the MILESTONE_GOALS category. Ask about their biggest goals for the next 2-10 years. Include specific examples in parentheses to help guide them, such as: (getting into specific colleges, pursuing certain careers, starting a business, graduate school plans, earning scholarships, etc.). Be enthusiastic, engaging, and add your own natural conversational style while covering these key areas.${historyText}`;
        } else {
            // Check if we need to transition categories
            if (session.questionsInCategory === 0 && session.totalQuestionsAsked > 0) {
                const categoryNames = {
                    'INTERMEDIATE_MILESTONES': 'intermediate milestones',
                    'SECTORS': 'specific sectors and fields',
                    'SKILLS': 'key skills to develop'
                };
                
                const transitionText = categoryNames[status.category] || 'the next category';
                specificPrompt = `You are transitioning to the ${status.category} category. Announce the transition by saying "Now let's explore your ${transitionText}" and then ask your first question in this category. The student just said: "${userInput}"${historyText}`;
            } else {
                specificPrompt = `You are in the ${status.category} category, asking question ${status.categoryProgress}. The student just responded: "${userInput}"
                
                Build on their response and ask a follow-up question that digs deeper into this category. Stay focused on ${status.category} only.
                
                Category context:
                - MILESTONE_GOALS: Focus on big 5-10 year dreams and ambitions
                - INTERMEDIATE_MILESTONES: Focus on 1-2 year stepping stones and achievements
                - SECTORS: Focus on specific industries, fields, and work environments
                - SKILLS: Focus on concrete capabilities and competencies to develop${historyText}`;
            }
        }

        const messages = [
            { role: 'system', content: CONVERSATION_SYSTEM_PROMPT },
            { role: 'user', content: specificPrompt }
        ];

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            max_tokens: 150,
            temperature: 0.3
        });

        const aiResponse = response.choices[0].message.content;
        
        // Store conversation
        if (!isFirstQuestion) {
            session.conversationHistory.push({ role: 'user', content: userInput });
            session.categoryResponses[CATEGORIES[session.currentCategoryIndex]].push(userInput);
        }
        session.conversationHistory.push({ role: 'assistant', content: aiResponse });

        return aiResponse;
    } catch (error) {
        console.error('Error getting conversation response:', error);
        return `Question ${getConversationStatus(sessionId)?.totalProgress || '1/16'}: What interests you most about your future goals?`;
    }
}

async function getDataExtractionResponse(sessionId, userInput) {
    try {
        const session = activeSessions.get(sessionId);
        if (!session) return null;

        const historyText = session.conversationHistory.length > 0 ? 
            `\nFULL CONVERSATION CONTEXT:\n${session.conversationHistory.map(msg => `${msg.role === 'user' ? 'Student' : 'Counselor'}: ${msg.content}`).join('\n')}\n` : 
            '\nCONVERSATION CONTEXT: [This is the first response]\n';

        const currentCategory = CATEGORIES[session.currentCategoryIndex];
        const categoryContext = `\nCURRENT INTERVIEW CONTEXT:\n- Category: ${currentCategory}\n- Question ${session.totalQuestionsAsked + 1}/16\n- Category Progress: ${session.questionsInCategory + 1}/4\n`;

        const previousExtractions = session.extractedDataHistory.length > 0 ? 
            `\nPREVIOUS EXTRACTIONS:\n${session.extractedDataHistory.slice(-3).map(extraction => 
                `Q${extraction.question_number}: ${JSON.stringify(extraction.extracted_data)}`
            ).join('\n')}\n` : 
            '\nPREVIOUS EXTRACTIONS: [None yet]\n';

        const analysisPrompt = `Analyze this student response in the context of the full conversation and extract relevant data.

CURRENT RESPONSE TO ANALYZE: "${userInput}"
${categoryContext}${historyText}${previousExtractions}

Instructions:
- Consider the full conversation context when making extractions
- Look for patterns and themes across all responses
- Be consistent with previous extractions while identifying new information
- The student is currently in the ${currentCategory} category, but extract data for ALL categories if relevant`;

        const messages = [
            { role: 'system', content: DATA_EXTRACTION_SYSTEM_PROMPT },
            { role: 'user', content: analysisPrompt }
        ];

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            max_tokens: 600,
            temperature: 0.1
        });

        const aiResponse = response.choices[0].message.content;
        
        try {
            const extractedData = JSON.parse(aiResponse);
            return extractedData;
        } catch (parseError) {
            console.log('Data extraction AI response (non-JSON):', aiResponse);
            return null;
        }
    } catch (error) {
        console.error('Error getting data extraction response:', error);
        return null;
    }
}

// ================================================================================================
// HELPER FUNCTIONS - Cleaned up and focused on conversation management
// ================================================================================================
// Note: Data extraction and file saving functions moved to dataExtraction.js

// Start server
app.listen(PORT, () => {
    console.log(`🚀 UltraIntelligence API server running on port ${PORT}`);
    console.log(`📱 Frontend should connect to: http://localhost:${PORT}`);
});

module.exports = app;

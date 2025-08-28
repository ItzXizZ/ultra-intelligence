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

// ================================================================================================
// UNIFIED GOAL COUNSELOR SYSTEM
// ================================================================================================

// Single unified prompt that handles all phases
const UNIFIED_GOAL_COUNSELOR_PROMPT = `

Student Goal Identification Agent
You are an AI counselor agent that guides ambitious high school students through a structured 5-phase goal identification process. You follow a simple control loop with phase-based todo management to systematically extract milestone goals, intermediate goals, and supporting information.
Core Mission
Your ONLY purpose is to identify student goals through focused questioning. You do NOT give advice, suggestions, or recommendations. You ONLY ask questions to extract goal information and move through the required phases.
Agent Workflow & Todo Management
You operate through exactly 4 phases in strict sequence. Use your internal todo list to track phase completion:
PHASE SEQUENCE:
MILESTONE_PHASE → Identify 1-3 milestone goals AND ask about extracurriculars
INTERMEDIATE_PHASE → Identify 5-7 intermediate goals
EXTRACTION_PHASE → Extract and rank all goals
COMPLETION_PHASE → Signal end with completion code
IMPORTANT: You MUST complete each phase fully before proceeding to the next. NEVER skip phases or work on multiple phases simultaneously.
CRITICAL: Each phase transition signal must be sent as a SINGLE, STANDALONE MESSAGE with no other text.

Phase 1: Milestone Goal Identification
<system-reminder> CRITICAL: If this is the first message from the student, you MUST start with the EXACT greeting and question below. Do not deviate from this exact wording. </system-reminder>
First Message Protocol
EXACT GREETING REQUIRED: "Hi! If you could fast forward to 2-5 years from now, what long term goal / goals do you have? This could be anything from getting accepted into a dream university, launching your own startup, or becoming a successful practitioner in a field you're passionate about."
Milestone Goal Categories
IMPORTANT: You may ONLY identify goals from these EXACT categories. NEVER create new categories.
A. Higher Education Goals
competitive_university_acceptance
top_20_university_acceptance
top_10_university_acceptance
specialized_program_acceptance
full_scholarship
significant_financial_aid
B. Alternative Post-Graduation Pathways
workforce_entry
service_year
apprenticeship_program
C. Graduate/Professional School Goals
medical_school_path
law_school_path
graduate_school_stem
business_school_path
D. Business & Entrepreneurship Milestones
startup_founding
npo_founding
profitable_business
venture_capital_funding
business_exit
creator_economy
Milestone Phase Response Format
When student responds with goals, immediately identify the key milestones and respond with:
"It seems you're mainly interested in [goal 1], [goal 2], and [goal 3]. What extracurriculars have you participated in to reach towards these goals?"
<good-example> Student: "I want to get into Stanford for computer science and maybe start a tech company someday." Response: "It seems you're mainly interested in top_10_university_acceptance and startup_founding. What extracurriculars have you participated in to reach towards these goals?" </good-example> <bad-example> Student: "I want to get into Stanford for computer science and maybe start a tech company someday." Response: "That's fascinating! Stanford is an excellent choice. What specific aspects of computer science interest you most? Have you considered what type of startup you'd like to create?" </bad-example>
IMPORTANT: Be concise and direct. Don't ask follow-up questions about their goals - just identify them and immediately move to extracurriculars.
Extracurricular Analysis Protocol
When student provides their extracurricular activities (formatted with numbers and descriptions), you must:
1. Provide a very brief (2-3 sentences) analysis of how these activities connect to their identified milestone goals
2. Acknowledge the alignment between their activities and goals
3. Then immediately send the phase completion signal

Automatic Phase Transition
When you receive the message "BEGIN_INTERMEDIATE_PHASE", immediately start asking intermediate goal questions without any acknowledgment or transition text. Go straight to your first intermediate goal question. 

Phase 1 Completion Signal
Once you have identified 1-3 milestone goals AND analyzed their extracurricular activities, send a SINGLE MESSAGE with only this signal:
<PHASE_COMPLETE>MILESTONE_PHASE</PHASE_COMPLETE>

Phase 2: Intermediate Goal Identification
<system-reminder> Focus on identifying 5-7 intermediate goals from the strict category list below. </system-reminder>
Intermediate Goal Categories
IMPORTANT: You may ONLY identify goals from these EXACT categories. NEVER create new categories.
STRICT CATEGORY LIST:
college_apps_submit
essays_complete
recommendation_letters
interviews_prep
portfolio_create
academic_record_enhancement
standardized_test_achievement
olympiad_improvement
course_rigor
research_project_development
research_publication
lab_experience
conference_present
internship_work_experience
job_shadowing
professional_networking_exploration
olympiad_success
leadership_position_development
club_founding
volunteer_hours
startup_experience
certification_earn
technical_skills
work_experience
Phase 3 Question Strategy
RESPONSE FORMAT:
1-2 sentences, maximum 30 words total
Conversational and specific to their situation
NO bullet points, lists, or role prefixes
ALWAYS ask about GOALS, never background information
TOPIC TRANSITION RULES:
After 3 questions on same topic → switch to different area
Explore different intermediate goal areas systematically
Tailor questions to their milestone goals and extracurriculars
EXAMPLES: <good-example> "What academic short-term goals are you focusing on this year for your Stanford application?" </good-example>
<good-example> "What leadership roles are you pursuing to complement your entrepreneurial experience? Do you have goals for where you want to be in a few months?" </good-example> <bad-example> "Impressive leadership experience! Are there any academic competitions or advanced courses you're planning to pursue to further enhance your application?" </bad-example>
IMPORTANT: The bad example asks for background information instead of goals. ALWAYS focus on goal identification.
Phase 2 Completion Criteria
Continue until you have identified 5-7 distinct intermediate goals from the strict category list. Then send a SINGLE MESSAGE with only this signal:
<PHASE_COMPLETE>INTERMEDIATE_PHASE</PHASE_COMPLETE>

Phase 3: Goal Extraction & Ranking
<system-reminder> Now extract and rank ALL goals identified during the conversation using the binary + stack ranking approach. </system-reminder>
Extraction Framework
Analyze the entire conversation and extract goals into 4 hierarchical categories:
1. MILESTONE_GOALS (From Phase 1 categories) 2. INTERMEDIATE_MILESTONES (From Phase 3 categories) 3. SKILLS (Inferred from interests and goals):
programming_languages, ai_machine_learning, data_science_analytics, web_development
advanced_mathematics, statistics_data_analysis, financial_analysis, economics
biology_mastery, chemistry_mastery, physics_mastery, scientific_method
public_communication, leadership_management, business_fundamentals, marketing_strategy
creative_writing, technical_writing, graphic_design, user_experience
foreign_language, debate_argumentation, project_management, sales_skills
4. SECTORS (Inferred from goals and interests):
software_technology, artificial_intelligence, data_science, cybersecurity_field
investment_banking_field, quantitative_finance, venture_capital_field, entrepreneurship_business
medicine_clinical, medicine_research, biomedical_engineering, healthcare_field_entry
law_corporate, government_policy, nonprofit_sector, consulting
engineering_fields, environmental_science, creative_industry_entry, education_teaching
Binary + Stack Ranking Process
STEP 1 - BINARY DECISION: For each category, decide YES or NO
YES: Clearly applies based on student responses
NO: Does not apply or was not mentioned
STEP 2 - STACK RANKING: For all YES categories, rank 1, 2, 3, etc.
Lower numbers = higher importance (1 = most important)
Rank based on how strongly expressed or central to goals
JSON Output Format
{
  "milestone_goals": [
    {"category_name": "startup_founding", "ranking": 1},
    {"category_name": "top_10_university_acceptance", "ranking": 2}
  ],
  "intermediate_milestones": [
    {"category_name": "academic_record_enhancement", "ranking": 1},
    {"category_name": "research_project_development", "ranking": 2}
  ],
  "skills": [
    {"category_name": "programming_languages", "ranking": 1},
    {"category_name": "business_fundamentals", "ranking": 2}
  ],
  "sectors": [
    {"category_name": "software_technology", "ranking": 1}
  ]
}

IMPORTANT: Only include categories that get a YES decision. Use ranking numbers (1, 2, 3...) not percentages.
Phase 3 Completion Signal
After outputting the JSON, send a SINGLE MESSAGE with only this signal:
<PHASE_COMPLETE>EXTRACTION_PHASE</PHASE_COMPLETE>

Phase 4: Completion Phase
Final Response Protocol
Provide a brief closing statement acknowledging the goal identification process is complete.
EXAMPLE: "Perfect! I've identified your key goals across all areas. This gives us a clear picture of your academic and career objectives."
Final Completion Signal
End with a SINGLE MESSAGE containing only the completion code:
<SESSION_COMPLETE>GOAL_IDENTIFICATION_FINISHED</SESSION_COMPLETE>

Critical Operating Instructions
Conversation Flow Control
IMPORTANT: You operate as a single-purpose agent with one main control loop. Follow the phase sequence exactly:
NEVER skip phases or work out of order
NEVER give advice, suggestions, or recommendations
NEVER create goal categories outside the strict lists
ALWAYS focus questions on goal identification, not background
ALWAYS signal phase transitions with the required codes
Response Guidelines
Keep responses concise (1-2 sentences maximum)
Be conversational but focused on goal extraction
Use natural language, avoid robotic phrasing
NEVER use bullet points, lists, or excessive formatting in conversation
NEVER start responses with praise like "Great!" or "Excellent!"
Error Prevention
<system-reminder> If you find yourself wanting to give advice or suggestions, STOP. Your role is purely goal identification through questioning. </system-reminder>
COMMON MISTAKES TO AVOID:
Asking about background instead of goals
Creating new goal categories
Giving advice or recommendations
Skipping phase completion signals
Working on multiple phases simultaneously
Target Audience
This system is designed for ambitious high school students interested in:
Prestigious university admissions
STEM fields and technology
Business and entrepreneurship
Medicine and healthcare
Academic competitions and olympiads
Leadership and extracurricular excellence
IMPORTANT: Stay focused on goal identification. Let the student guide the conversation content while you guide the process structure.

System Reminders
<system-reminder> Remember: You are a goal identification agent, not an advice-giving counselor. Your success is measured by how effectively you extract and categorize student goals through focused questioning. </system-reminder> <system-reminder> Phase discipline is critical. Complete each phase fully before moving to the next. Use the completion signals to maintain proper workflow control. </system-reminder> <system-reminder> The goal categories are fixed and cannot be modified. If a student mentions goals that don't fit the categories, find the closest match or note it for the skills/sectors inference in Phase 4. </system-reminder>


`
// Store active sessions (simplified)
const activeSessions = new Map();

// Simplified session helper
async function getSession(sessionId) {
    if (activeSessions.has(sessionId)) {
        return activeSessions.get(sessionId);
    }
    
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('students')
                .select('*')
                .eq('session_id', sessionId)
                .single();
                
            if (data && !error) {
                const session = {
                    sessionId: data.session_id,
                    studentId: data.id,
                    studentName: data.name,
                    studentAge: data.age,
                    studentLocation: data.location,
                    studentHighschool: data.highschool,
                    studentGpa: data.gpa,
                    studentSatAct: data.sat_act,
                    conversationHistory: data.conversation_history || [],
                    phase: data.phase || 'milestone_identification'
                };
                
                activeSessions.set(sessionId, session);
                return session;
        }
    } catch (error) {
            console.error('Error fetching session from database:', error);
        }
    }
    
    return null;
}

// ================================================================================================
// DATA EXTRACTION FUNCTIONS (Merged from dataExtraction.js)
// ================================================================================================

/**
 * Save extracted data to Supabase database across multiple tables
 */
async function saveExtractedData(studentId, extractedData) {
    if (!extractedData || !studentId) return;

    const hasData = (extractedData.milestone_goals && extractedData.milestone_goals.length > 0) ||
                   (extractedData.intermediate_milestones && extractedData.intermediate_milestones.length > 0) ||
                   (extractedData.skills && extractedData.skills.length > 0) ||
                   (extractedData.sectors && extractedData.sectors.length > 0);

    if (!hasData) {
        console.log('No meaningful data to save to database');
        return;
    }

    try {
        // Save milestone goals
        if (extractedData.milestone_goals) {
            for (const goal of extractedData.milestone_goals) {
                await supabase
                    .from('milestone_goals')
                    .upsert({
                        student_id: studentId,
                        category_name: goal.category_name,
                        percentage: goal.ranking || goal.percentage
                    }, { onConflict: 'student_id,category_name' });
            }
        }

        // Save intermediate milestones
        if (extractedData.intermediate_milestones) {
            for (const milestone of extractedData.intermediate_milestones) {
                await supabase
                    .from('intermediate_milestones')
                    .upsert({
                        student_id: studentId,
                        category_name: milestone.category_name,
                        percentage: milestone.ranking || milestone.percentage
                    }, { onConflict: 'student_id,category_name' });
            }
        }

        // Save skills
        if (extractedData.skills) {
            for (const skill of extractedData.skills) {
                await supabase
                    .from('skills')
                    .upsert({
                        student_id: studentId,
                        category_name: skill.category_name,
                        percentage: skill.ranking || skill.percentage
                    }, { onConflict: 'student_id,category_name' });
            }
        }

        // Save sectors
        if (extractedData.sectors) {
            for (const sector of extractedData.sectors) {
                await supabase
                    .from('sectors')
                    .upsert({
                        student_id: studentId,
                        category_name: sector.category_name,
                        percentage: sector.ranking || sector.percentage
                    }, { onConflict: 'student_id,category_name' });
            }
        }

        console.log('✅ Extracted data saved to database successfully');
    } catch (error) {
        console.error('❌ Error saving extracted data:', error);
    }
}

// ================================================================================================
// SINGLE CONVERSATION FUNCTION (Replaces all previous conversation functions)
// ================================================================================================

/**
 * Single unified conversation function that handles all phases
 */
async function getConversationResponse(sessionId, userInput, isFirstMessage = false, sendSSE = null) {
    try {
        const session = await getSession(sessionId);
        if (!session) throw new Error('Session not found');

        // Build conversation context
        const messages = [
            { role: 'system', content: UNIFIED_GOAL_COUNSELOR_PROMPT }
        ];

        // Add conversation history
        if (session.conversationHistory && session.conversationHistory.length > 0) {
            messages.push(...session.conversationHistory);
        }

        // Add current user message if not first message
        if (!isFirstMessage && userInput) {
            messages.push({ role: 'user', content: userInput });
        }

        // Make API call to OpenAI
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            max_tokens: 400,
            temperature: 0.3,
            stream: !!sendSSE  // Stream if SSE callback provided
        });

        let aiResponse = '';
        
        if (sendSSE) {
            // Handle streaming response
        for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                aiResponse += content;
                sendSSE({
                    type: 'content',
                    content: content
                });
            }
            }
        } else {
            // Handle regular response
            aiResponse = response.choices[0].message.content;
        }

        // Handle phase signals and extraction
        const phaseChanged = handlePhaseSignals(aiResponse, session);
        
        // Store conversation
        if (!isFirstMessage && userInput) {
            session.conversationHistory.push({ role: 'user', content: userInput });
        }
        session.conversationHistory.push({ role: 'assistant', content: aiResponse });

        return {
            message: aiResponse,
            phase: session.phase,
            phaseChanged
        };

    } catch (error) {
        console.error('Error in conversation response:', error);
        const fallback = isFirstMessage ? 
            "Hi! If you could fast forward to 2-5 years from now, what long term goal / goals do you have? This could be anything from getting accepted into a dream university, launching your own startup, or becoming a successful practitioner in a field you're passionate about." :
            "Could you tell me more about your goals?";
        
        if (sendSSE) {
            sendSSE({
                type: 'content',
                content: fallback
            });
        }
        
        return {
            message: fallback,
            phase: 'milestone_identification',
            phaseChanged: false
        };
    }
}

/**
 * Handle phase transition signals from the AI response
 */
function handlePhaseSignals(aiResponse, session) {
    let phaseChanged = false;
    
    if (aiResponse.includes('<PHASE_COMPLETE>MILESTONE_PHASE</PHASE_COMPLETE>')) {
        session.phase = 'intermediate_goals';
        phaseChanged = true;
        console.log('📍 Phase transition: MILESTONE → INTERMEDIATE');
        
    } else if (aiResponse.includes('<PHASE_COMPLETE>INTERMEDIATE_PHASE</PHASE_COMPLETE>')) {
        session.phase = 'extraction';
        phaseChanged = true;
        console.log('📍 Phase transition: INTERMEDIATE → EXTRACTION');
        
    } else if (aiResponse.includes('<PHASE_COMPLETE>EXTRACTION_PHASE</PHASE_COMPLETE>')) {
        // Extract JSON data from the response
        extractDataFromResponse(aiResponse, session);
        session.phase = 'completion';
        phaseChanged = true;
        console.log('📍 Phase transition: EXTRACTION → COMPLETION');
        
    } else if (aiResponse.includes('<SESSION_COMPLETE>GOAL_IDENTIFICATION_FINISHED</SESSION_COMPLETE>')) {
        session.phase = 'completed';
        phaseChanged = true;
        console.log('✅ Session completed');
    }
    
    return phaseChanged;
}

/**
 * Extract JSON data from extraction phase response
 */
function extractDataFromResponse(aiResponse, session) {
    try {
        // Look for JSON in the response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const extractedData = JSON.parse(jsonMatch[0]);
            
            // Store extracted data for later database saving
            session.extractedData = extractedData;
            console.log('📊 Extracted data from conversation:', extractedData);
        }
    } catch (error) {
        console.error('Error extracting JSON from response:', error);
    }
}

// ================================================================================================
// HELPER FUNCTIONS
// ================================================================================================

/**
 * Get comprehensive student data from database
 */
async function getComprehensiveStudentData(studentId) {
    try {
        const [milestoneGoals, intermediateMilestones, skills, sectors, extracurriculars, studentInfo] = await Promise.all([
            supabase.from('milestone_goals').select('*').eq('student_id', studentId),
            supabase.from('intermediate_milestones').select('*').eq('student_id', studentId),
            supabase.from('skills').select('*').eq('student_id', studentId),
            supabase.from('sectors').select('*').eq('student_id', studentId),
            supabase.from('extracurriculars').select('*').eq('student_id', studentId),
            supabase.from('students').select('*').eq('id', studentId).single()
        ]);

        return {
            student_info: studentInfo.data || null,
            milestone_goals: milestoneGoals.data || [],
            intermediate_milestones: intermediateMilestones.data || [],
            skills: skills.data || [],
            sectors: sectors.data || [],
            extracurriculars: extracurriculars.data || []
        };
    } catch (error) {
        console.error('Error getting comprehensive student data:', error);
        return null;
    }
}

/**
 * Extract student data to file (simplified version)
 */
async function extractStudentDataToFile(session) {
    try {
        const comprehensiveData = await getComprehensiveStudentData(session.studentId);
        
        const studentData = {
            student_info: {
                id: session.studentId,
                name: session.studentName,
                age: session.studentAge,
                location: session.studentLocation,
                highschool: session.studentHighschool,
                gpa: session.studentGpa,
                sat_act: session.studentSatAct,
                session_date: new Date().toISOString(),
                conversation_structure: 'Unified Goal Identification System'
            },
            conversation_history: session.conversationHistory,
            extracted_data: session.extractedData,
            comprehensive_database_data: comprehensiveData,
            summary: {
                total_goals_identified: (comprehensiveData?.milestone_goals?.length || 0) + 
                                      (comprehensiveData?.intermediate_milestones?.length || 0),
                total_skills_identified: comprehensiveData?.skills?.length || 0,
                total_sectors_identified: comprehensiveData?.sectors?.length || 0,
                conversation_length: session.conversationHistory.length,
                phase_completed: session.phase || 'unknown'
            }
        };

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `student_${session.studentId}_${session.studentName.replace(/\s+/g, '_')}_${timestamp}.json`;
        const fs = require('fs');
        const path = require('path');
        
        const dataFolder = path.join(__dirname, 'data');
        if (!fs.existsSync(dataFolder)) {
            fs.mkdirSync(dataFolder);
        }

        const filepath = path.join(dataFolder, filename);
        fs.writeFileSync(filepath, JSON.stringify(studentData, null, 2));
        
        console.log(`📄 Student data extracted successfully to: ${filepath}`);
        return filepath;
    } catch (error) {
        console.error('❌ Error extracting student data to file:', error);
        return null;
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

// Student basic info form submission
app.post('/api/submit-basic-info', async (req, res) => {
    try {
        const { name, age, location, highschool, gpa, satAct } = req.body;
        
        if (!name || !age || !location) {
            return res.status(400).json({ error: 'Name, age, and location are required' });
        }

        // Create student with basic info
        const { data, error } = await supabase
            .from('students')
            .insert([{ 
                name: name, 
                email: `${name.toLowerCase().replace(/\s+/g, '.')}@student.temp`,
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
        
        // Create simplified session
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
            phase: 'milestone_identification'
        };

        activeSessions.set(sessionId, session);

        // Get first response using unified system
        const result = await getConversationResponse(sessionId, "", true);
        
        res.json({
            sessionId,
            studentId,
            message: result.message,
            phase: result.phase
        });

    } catch (error) {
        console.error('Error submitting basic info:', error);
        res.status(500).json({ error: 'Failed to submit basic information' });
    }
});



// Main message endpoint (simplified to use unified system)
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

        // Use unified conversation function
        const result = await getConversationResponse(sessionId, message, false);

        res.json({
            message: result.message,
            phase: result.phase,
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
    if (!openai || !supabase) {
        return res.status(500).json({ error: 'Required services not configured' });
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

        // Set up Server-Sent Events
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control, Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        });

        const sendSSE = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        // Send start message
        sendSSE({
            type: 'start',
            phase: session.phase,
            sessionInfo: {
                studentName: session.studentName,
                conversationLength: session.conversationHistory.length
            }
        });

        // Use unified conversation function with streaming
        const result = await getConversationResponse(sessionId, message, false, sendSSE);

        // Send completion message
        sendSSE({
            type: 'complete',
            message: result.message,
            phase: result.phase
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

// Get conversation status
app.get('/api/status/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const session = await getSession(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
        phase: session.phase,
        conversationLength: session.conversationHistory.length,
        studentName: session.studentName
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

        // Save any extracted data from the session
        if (session.extractedData && session.studentId) {
            await saveExtractedData(session.studentId, session.extractedData);
            console.log('✅ Extracted data saved to database');
        }

        // Get comprehensive student data from database
        const comprehensiveData = await getComprehensiveStudentData(session.studentId);

        // Create comprehensive summary
        const fullData = {
            student_info: {
                name: session.studentName,
                age: session.studentAge,
                location: session.studentLocation,
                highschool: session.studentHighschool,
                gpa: session.studentGpa,
                sat_act: session.studentSatAct
            },
            conversation_length: session.conversationHistory.length,
            phase: session.phase,
            conversation_history: session.conversationHistory || [],
            milestone_goals: comprehensiveData?.milestone_goals || [],
            intermediate_milestones: comprehensiveData?.intermediate_milestones || [],
            skills: comprehensiveData?.skills || [],
            sectors: comprehensiveData?.sectors || [],
            extracurriculars: comprehensiveData?.extracurriculars || [],
            extracted_data: session.extractedData || {}
        };

        console.log('✅ Summary generated successfully');

        // Extract data to file if needed
        const filePath = await extractStudentDataToFile(session);

        res.json({
            success: true,
            summary: 'Comprehensive data extraction completed',
            comprehensiveData: fullData,
            filePath: filePath
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

// ================================================================================================
// SIMPLIFIED SERVER ARCHITECTURE COMPLETE
// ================================================================================================

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

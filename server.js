const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Load environment variables
require('dotenv').config();

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// AI System Prompts (copied from index.js)
const CONVERSATION_SYSTEM_PROMPT = `
ROLE DEFINITION
You are a strategic AI that gathers information on students to build comprehensive goal hierarchies: BIG MILESTONE GOALS → HIGH SCHOOL MILESTONES → SECTOR INTERESTS → SKILLS TO DEVELOP.
CRITICAL CONTEXT: Your role is to gather information on student goals, NOT to give advice.

GOAL HIERARCHY FRAMEWORK
1. MILESTONE GOALS (2-10 years)
Higher Education & Alternative Paths

University acceptance (competitive, top 20, top 10, specialized programs)
Financial aid (merit scholarships, need-based aid)
Alternative paths (workforce entry, service year, apprenticeships)

Graduate/Professional School

Medical, law, graduate STEM, business school paths

Business & Entrepreneurship

Startup founding, profitable business, VC funding, business exit, creator economy

Career Field Entry

Tech, finance, consulting, research, healthcare, creative industries

2. IMMEDIATE MILESTONES (3 months-2 years)
A. College Applications

Submit applications, complete essays, secure recommendations, prepare interviews, build portfolio

B. Testing & Academics

SAT/ACT improvement, AP/IB exams, GPA improvement, course rigor, academic awards

C. Research & Experience

Independent research, publications, internships, lab experience, conferences, mentorship

D. Competitions & Leadership

Academic competitions (Science Olympiad, math, debate, robotics, coding)
Leadership positions, club founding, volunteer work, community projects

E. Skill Building

Technical proficiency, certifications, language fluency, presentation skills

3. SKILLS/LEARNING GOALS
Academic Mastery

STEM subjects (math, physics, chemistry, biology, CS)
Liberal arts (economics, history, literature, languages, philosophy)

Technical Skills

Programming, data science, web/mobile development, AI/ML, cybersecurity, design software

Research & Analysis

Scientific method, experimental design, statistical analysis, data visualization

Communication

Public speaking, scientific writing, technical documentation, debate, media communication

Business & Leadership

Project management, financial analysis, marketing, sales, negotiation, strategic planning

Creative & Design

Graphic design, UX/UI, photography, video production, music, digital art

CONVERSATION STRATEGY
QUESTIONING PHASES
The conversation should flow through approximately 12 questions total (~3 questions per phase):

Phase 1 - BIG MILESTONE GOALS: Discover their 2-10 year ambitions
Phase 2 - HIGH SCHOOL MILESTONES: Break down what they need to accomplish in high school
Phase 3 - SECTOR FOCUS: Identify specific fields/industries they're interested in
Phase 4 - SKILLS: Define capabilities they can start building now

HIGH SCHOOL FOCUS RULES

When they mention college goals (Harvard Law, Stanford, etc.), ask about HIGH SCHOOL preparation
Focus on: courses to take, extracurriculars to join, competitions to enter, leadership roles to pursue
Ask about: GPA goals, standardized test prep, summer programs, internships, volunteer work
Consider their current grade level and time remaining in high school

CRITICAL CONVERSATION RULES
❌ ABSOLUTELY FORBIDDEN PATTERNS

NEVER ask multiple questions in one response
NEVER use "First... Second... Finally..." or numbered lists
NEVER use compound questions with multiple question marks
NEVER give advice or suggestions

Examples of FORBIDDEN responses:

"First, what courses... Second, what extracurriculars... Finally, have you considered..."
"What courses are you taking? Are there any clubs? Have you thought about your GPA?"

✅ REQUIRED RESPONSE PATTERN

Brief acknowledgment (1 sentence)
ONE focused question (1 sentence with ONE question mark)
STOP IMMEDIATELY

Examples of CORRECT responses:

"MIT for robotics is ambitious! What robotics or tech courses are you currently taking or planning to take?"
"Business is a great field! Have you participated or do you plan to participate in any business competitions?"
"That's fantastic work on cancer genetics! Have you reached out to any local labs or hospitals about getting hands-on research internship experience?"

KEY REMINDERS

ONE QUESTION ONLY - If you want to ask multiple things, choose the MOST STRATEGIC one
FOCUS ON GOALS - Always steer toward identifying and categorizing their aspirations
NO ADVICE - Gather information, don't give guidance
`;

const DATA_EXTRACTION_SYSTEM_PROMPT = `You are a data extraction AI that analyzes student responses using a goal hierarchy framework: MILESTONE GOALS → INTERMEDIATE MILESTONES → SECTOR INTERESTS → SKILLS.

ANALYSIS FRAMEWORK:
Your task is to analyze student responses and extract relevant information into these 4 hierarchical categories:

1. MILESTONE_GOALS (Big 5-10 year ambitions):
- competitive_university_acceptance, top_20_university_acceptance, top_10_university_acceptance
- specialized_program_acceptance, full_scholarship, significant_financial_aid
- medical_school_path, law_school_path, graduate_school_stem, business_school_path
- startup_founding, profitable_business, venture_capital_funding, business_exit, creator_economy
- tech_industry_entry, finance_industry_entry, consulting_entry, research_career_start
- healthcare_field_entry, creative_industry_entry, workforce_entry, service_year

2. INTERMEDIATE_MILESTONES (1-2 year stepping stones):
- college_apps_submit, essays_complete, recommendation_letters, interviews_prep, portfolio_create
- academic_record_enhancement, standardized_test_achievement, gpa_improvement, course_rigor
- research_project_development, research_publication, lab_experience, conference_present
- internship_work_experience, job_shadowing, informational_interviews, professional_networking_exploration
- competition_success, leadership_position_development, club_founding, volunteer_hours
- startup_experience, certification_earn, technical_skills, work_experience

3. SKILLS (Concrete capabilities to develop):
- programming_languages, ai_machine_learning, data_science_analytics, web_development
- advanced_mathematics, statistics_data_analysis, financial_analysis, economics
- biology_mastery, chemistry_mastery, physics_mastery, scientific_method
- public_communication, leadership_management, business_fundamentals, marketing_strategy
- creative_writing, technical_writing, graphic_design, user_experience
- foreign_language, debate_argumentation, project_management, sales_skills

4. SECTORS (Professional fields and industries):
- software_technology, artificial_intelligence, data_science, cybersecurity_field
- investment_banking_field, quantitative_finance, venture_capital_field, entrepreneurship_business
- medicine_clinical, medicine_research, biomedical_engineering, healthcare_field_entry
- law_corporate, government_policy, nonprofit_sector, consulting
- engineering_fields, environmental_science, creative_industry_entry, education_teaching

EXTRACTION PRINCIPLES:
- BIG GOALS drive everything (MILESTONES_GOALS): Look for ambitious 2-10 year statements
- INTERMEDIATE MILESTONES: What they mention needing to do first/next
- SECTORS: Specific fields they mention or goals imply
- SKILLS: Concrete capabilities they mention or goals require

SCORING GUIDANCE:
- High confidence (80-95%): Explicitly stated goals/interests
- Medium confidence (60-79%): Strongly implied by their goals
- Lower confidence (40-59%): Logically connected but not directly stated

For each category, provide JSON with:
- category_name: specific category from lists above
- percentage: 0-100 likelihood/interest score
- confidence: 0-100 confidence in assessment

Return empty object {} only if response contains no goal-relevant information.`;

// Global state for current session
let currentStudentId = null;
let currentStudentName = null;
let currentStudentEmail = null;
let conversationHistory = [];
let extractedDataHistory = [];

// API Routes

// Create new student session
app.post('/api/start-session', async (req, res) => {
    try {
        const { name, email } = req.body;
        
        // Create student in database
        const { data, error } = await supabase
            .from('students')
            .insert([
                { 
                    name: name, 
                    email: email, 
                    exploration_openness: 'medium'
                }
            ])
            .select();

        if (error) throw error;

        currentStudentId = data[0].id;
        currentStudentName = name;
        currentStudentEmail = email;
        conversationHistory = [];
        extractedDataHistory = [];

        // Get opening question using the actual AI system
        const openingResponse = await getConversationResponse("", 0);
        
        res.json({
            success: true,
            studentId: currentStudentId,
            openingMessage: openingResponse
        });
    } catch (error) {
        console.error('Error starting session:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get conversation response
app.post('/api/conversation', async (req, res) => {
    try {
        const { userInput } = req.body;
        
        if (!currentStudentId) {
            return res.status(400).json({ success: false, error: 'No active session' });
        }

        // Get conversation AI response using the actual AI system
        const conversationResponse = await getConversationResponse(userInput, -1);
        
        // Get data extraction AI response using the actual AI system
        const extractedData = await getDataExtractionResponse(userInput);
        
        if (extractedData) {
            extractedDataHistory.push({
                timestamp: new Date().toISOString(),
                user_input: userInput,
                extracted_data: extractedData
            });
            
            await saveExtractedData(extractedData);
        }

        res.json({
            success: true,
            response: conversationResponse,
            extractedData: extractedData
        });
    } catch (error) {
        console.error('Error in conversation:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Extract data to file
app.post('/api/extract-data', async (req, res) => {
    try {
        if (!currentStudentId) {
            return res.status(400).json({ success: false, error: 'No active session' });
        }

        const filepath = await extractStudentDataToFile();
        
        res.json({
            success: true,
            filepath: filepath
        });
    } catch (error) {
        console.error('Error extracting data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper functions (copied from index.js)
async function getConversationResponse(userInput, currentQuestionIndex) {
    try {
        // Create strategic prompt based on conversation phase
        let specificPrompt;
        
        if (currentQuestionIndex === 0) {
            // Opening question - discover big goals
            specificPrompt = `This is the start of the conversation. Ask about their biggest 5-10 year goal or where they see themselves professionally. Be enthusiastic and strategic.`;
        } else if (currentQuestionIndex === -1) {
            // Free conversation mode
            specificPrompt = `The student said: "${userInput}"
            
            Continue the strategic conversation by following the goal hierarchy: BIG GOALS → INTERMEDIATE MILESTONES → SECTORS → SKILLS. 
            Ask follow-up questions that help build their complete goal profile.`;
        } else {
            // Strategic follow-up based on their response
            specificPrompt = `The student just responded: "${userInput}"
            
            Follow the goal hierarchy strategy:
            - If they mentioned big goals, ask what they need to accomplish first to achieve them
            - If they mentioned intermediate steps, explore what field/sector interests them
            - If they mentioned sectors, ask about specific skills they need
            - Always build on what excites them most
            
            Be enthusiastic, strategic, and concise. Also consider the fact that they are a highschool student. The goal should be to gather information about their goals. Don't give advice. Just gather. (max 2 sentences).`;
        }

        const messages = [
            { role: 'system', content: CONVERSATION_SYSTEM_PROMPT },
            { role: 'user', content: specificPrompt }
        ];

        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: messages,
            max_tokens: 150,
            temperature: 0.3
        });

        const aiResponse = response.choices[0].message.content;
        conversationHistory.push({ role: 'user', content: userInput });
        conversationHistory.push({ role: 'assistant', content: aiResponse });

        return aiResponse;
    } catch (error) {
        console.error('Error getting conversation response:', error);
        return "That's interesting! Tell me more about what excites you most about your future.";
    }
}

async function getDataExtractionResponse(userInput) {
    try {
        const messages = [
            { role: 'system', content: DATA_EXTRACTION_SYSTEM_PROMPT },
            { role: 'user', content: `Analyze this student response and extract relevant data: "${userInput}"` }
        ];

        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: messages,
            max_tokens: 500,
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

async function saveExtractedData(extractedData) {
    if (!extractedData || !currentStudentId) return;

    const hasData = (extractedData.milestone_goals && extractedData.milestone_goals.length > 0) ||
                   (extractedData.intermediate_milestones && extractedData.intermediate_milestones.length > 0) ||
                   (extractedData.skills && extractedData.skills.length > 0) ||
                   (extractedData.sectors && extractedData.sectors.length > 0);

    if (!hasData) return;

    try {
        if (extractedData.milestone_goals) {
            for (const goal of extractedData.milestone_goals) {
                await supabase
                    .from('milestone_goals')
                    .upsert({
                        student_id: currentStudentId,
                        category_name: goal.category_name,
                        percentage: goal.percentage
                    }, { onConflict: 'student_id,category_name' });
            }
        }

        if (extractedData.intermediate_milestones) {
            for (const milestone of extractedData.intermediate_milestones) {
                await supabase
                    .from('intermediate_milestones')
                    .upsert({
                        student_id: currentStudentId,
                        category_name: milestone.category_name,
                        percentage: milestone.percentage
                    }, { onConflict: 'student_id,category_name' });
            }
        }

        if (extractedData.skills) {
            for (const skill of extractedData.skills) {
                await supabase
                    .from('skills')
                    .upsert({
                        student_id: currentStudentId,
                        category_name: skill.category_name,
                        percentage: skill.percentage
                    }, { onConflict: 'student_id,category_name' });
            }
        }

        if (extractedData.sectors) {
            for (const sector of extractedData.sectors) {
                await supabase
                    .from('sectors')
                    .upsert({
                        student_id: currentStudentId,
                        category_name: sector.category_name,
                        percentage: sector.percentage
                    }, { onConflict: 'student_id,category_name' });
            }
        }

        console.log('Data extracted and saved to database');
    } catch (error) {
        console.error('Error saving extracted data:', error);
    }
}

async function extractStudentDataToFile() {
    if (!currentStudentId) return null;

    try {
        const [milestoneGoals, intermediateMilestones, skills, sectors] = await Promise.all([
            supabase.from('milestone_goals').select('*').eq('student_id', currentStudentId),
            supabase.from('intermediate_milestones').select('*').eq('student_id', currentStudentId),
            supabase.from('skills').select('*').eq('student_id', currentStudentId),
            supabase.from('sectors').select('*').eq('student_id', currentStudentId)
        ]);

        const studentData = {
            student_info: {
                id: currentStudentId,
                name: currentStudentName,
                email: currentStudentEmail,
                session_date: new Date().toISOString(),
                total_conversation_turns: conversationHistory.length / 2
            },
            conversation_history: conversationHistory,
            extracted_data_history: extractedDataHistory,
            database_data: {
                milestone_goals: milestoneGoals.data || [],
                intermediate_milestones: intermediateMilestones.data || [],
                skills: skills.data || [],
                sectors: sectors.data || []
            }
        };

        return studentData;
    } catch (error) {
        console.error('Error extracting student data:', error);
        return null;
    }
}

// Start server
app.listen(PORT, () => {
    console.log(`UltraIntelligence API Server running on port ${PORT}`);
    console.log(`Ready to power the React UI with your AI system!`);
});

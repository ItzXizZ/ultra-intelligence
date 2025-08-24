// ================================================================================================
// ULTRAINTELLIGENCE STUDENT COUNSELOR SYSTEM - STRUCTURED 4x4 VERSION
// ================================================================================================
// A dual-AI system with enforced 4 questions per category structure (16 total questions)
// Categories: MILESTONE GOALS → INTERMEDIATE MILESTONES → SECTORS → SKILLS
// ================================================================================================

// ================================================================================================
// DEPENDENCIES AND CONFIGURATION
// ================================================================================================

const readline = require('readline');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ================================================================================================
// API CLIENT INITIALIZATION
// ================================================================================================

// Load environment variables
require('dotenv').config();

// Initialize OpenAI client for dual AI system
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Initialize Supabase client for data persistence
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Create readline interface for CLI interaction
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// ================================================================================================
// STRUCTURED CONVERSATION TRACKING
// ================================================================================================

// Categories in order - exactly 4 questions each
const CATEGORIES = [
    'MILESTONE_GOALS',      // Questions 1-4: Big 5-10 year ambitions
    'INTERMEDIATE_MILESTONES', // Questions 5-8: 1-2 year stepping stones
    'SECTORS',              // Questions 9-12: Professional fields/industries
    'SKILLS'                // Questions 13-16: Concrete capabilities
];

// Conversation state tracking
let currentCategoryIndex = 0;      // Which category we're in (0-3)
let questionsInCategory = 0;       // How many questions asked in current category (0-3)
let totalQuestionsAsked = 0;       // Total questions asked (0-16)

// Session variables
let currentStudentId = null;
let currentStudentName = null;
let currentStudentEmail = null;

// Conversation tracking
let conversationHistory = [];
let extractedDataHistory = [];
let categoryResponses = {
    MILESTONE_GOALS: [],
    INTERMEDIATE_MILESTONES: [],
    SECTORS: [],
    SKILLS: []
};

// ================================================================================================
// STRUCTURED AI SYSTEM PROMPTS
// ================================================================================================

const CONVERSATION_SYSTEM_PROMPT = `
ROLE DEFINITION
You are a strategic AI conducting a structured 16-question interview to build comprehensive student goal profiles.
CRITICAL: You MUST follow the exact category structure and ask exactly 4 questions per category, BUT use your natural conversational style and creativity within these guardrails.

STRUCTURED INTERVIEW FORMAT
Total Questions: 16 (4 per category)
Categories in Order:
1. MILESTONE_GOALS (Questions 1-4): Big 2-10 year ambitions
2. INTERMEDIATE_MILESTONES (Questions 5-8): 1-2 year stepping stones  
3. SECTORS (Questions 9-12): Professional fields/industries
4. SKILLS (Questions 13-16): Concrete capabilities to develop

CONVERSATIONAL FLEXIBILITY WITHIN STRUCTURE
- Use your own natural language and personality while staying on topic
- Be creative with phrasing but always stay within the current category
- Add variety to your questioning style - sometimes direct, sometimes exploratory
- Show genuine curiosity and engagement with their responses
- Use different approaches: hypothetical scenarios, comparisons, specific examples
- Make each question feel conversational, not like a form to fill out

CONVERSATION HISTORY USAGE
- Use the conversation history to avoid repeating similar questions
- Build on previous responses and show you remember what they've shared
- Make connections between current category and previous answers
- Reference specific things they've mentioned to show continuity
- Avoid asking for information they've already provided

CATEGORY DEFINITIONS & FLEXIBLE APPROACHES

MILESTONE_GOALS (Questions 1-4):
Core topics: University goals, graduate school, career entry, entrepreneurship, financial independence
Creative approaches:
- "What does success look like to you in 5 years?"
- "If you could skip ahead 10 years, what would you want to be doing professionally?"
- "What achievement would make you feel most proud when you look back?"
- "Where do you see yourself making the biggest impact in your career?"

INTERMEDIATE_MILESTONES (Questions 5-8):
Core topics: College apps, academic goals, research, leadership, competitions
Creative approaches:
- "What's the one thing you most want to accomplish before graduating high school?"
- "If you could only focus on three things this year, what would drive your college applications forward?"
- "What would make this year feel like a major stepping stone toward your bigger goals?"

SECTORS (Questions 9-12):
Core topics: Industries, work environments, specific fields, types of problems to solve
Creative approaches:
- "What kind of day-to-day work would energize you most?"
- "If you could shadow three different professionals for a week each, who would they be?"
- "What types of problems in the world do you feel drawn to solving?"

SKILLS (Questions 13-16):
Core topics: Technical skills, academic mastery, communication, leadership abilities
Creative approaches:
- "What's one skill that, if you mastered it, would unlock the most opportunities?"
- "If you could become world-class at something in the next two years, what would it be?"
- "What capabilities do you admire most in the people you look up to?"

STRICT STRUCTURAL RULES (NON-NEGOTIABLE)

✅ REQUIRED BEHAVIOR:
- Ask EXACTLY ONE question per response
- Stay within the current category until 4 questions are complete
- Use category-appropriate topics while being conversationally creative
- Build on previous answers and show conversation continuity
- Transition clearly when moving to next category

❌ ABSOLUTELY FORBIDDEN:
- Never ask multiple questions in one response
- Never jump between categories before completing 4 questions
- Never use numbered lists or compound questions
- Never give advice - only gather information creatively
- Never repeat information they've already shared

CATEGORY TRANSITION RULES:
- After 4 questions in MILESTONE_GOALS → announce transition naturally and ask first INTERMEDIATE_MILESTONES question
- After 4 questions in INTERMEDIATE_MILESTONES → announce transition naturally and ask first SECTORS question  
- After 4 questions in SECTORS → announce transition naturally and ask first SKILLS question
- After 4 questions in SKILLS → announce "Interview complete!"

RESPONSE FORMAT:
[Natural acknowledgment that references something specific they said] [ONE creative question related to current category]

EXAMPLES OF CREATIVE QUESTIONING WITHIN STRUCTURE:

Instead of template questions, be creative:
❌ Template: "What is your career goal?"
✅ Creative: "If money wasn't a factor, what type of work would make you excited to wake up every morning?"

❌ Template: "What skills do you want to develop?"  
✅ Creative: "What's one capability that, if you had it, would make you feel unstoppable in pursuing your goals?"

❌ Template: "What industry interests you?"
✅ Creative: "If you could be a fly on the wall in any workplace for a day, where would fascinate you most?"

REMEMBER: Stay within your assigned category, but bring your own conversational creativity and natural curiosity to make each question engaging and unique.
`;

const DATA_EXTRACTION_SYSTEM_PROMPT = `You are a data extraction AI that analyzes student responses using a goal hierarchy framework and full conversation context.

CRITICAL: Use the entire conversation history to make more accurate assessments. Look for patterns, connections, and reinforcing themes across all student responses.

ANALYSIS FRAMEWORK:
Extract relevant information into these 4 hierarchical categories:

1. MILESTONE_GOALS (Big 5-10 year ambitions):
- competitive_university_acceptance, top_20_university_acceptance, top_10_university_acceptance
- specialized_program_acceptance, full_scholarship, significant_financial_aid
- medical_school_path, law_school_path, graduate_school_stem, business_school_path
- startup_founding, profitable_business, venture_capital_funding, business_exit
- tech_industry_entry, finance_industry_entry, consulting_entry, research_career_start
- healthcare_field_entry, creative_industry_entry

2. INTERMEDIATE_MILESTONES (1-2 year stepping stones):
- college_apps_submit, essays_complete, recommendation_letters, interviews_prep
- academic_record_enhancement, standardized_test_achievement, gpa_improvement
- research_project_development, research_publication, lab_experience
- internship_work_experience, leadership_position_development, competition_success
- volunteer_hours, certification_earn, technical_skills_development

3. SECTORS (Professional fields and industries):
- software_technology, artificial_intelligence, data_science, cybersecurity_field
- investment_banking_field, quantitative_finance, venture_capital_field, entrepreneurship_business
- medicine_clinical, medicine_research, biomedical_engineering, healthcare_field_entry
- law_corporate, government_policy, consulting, engineering_fields
- creative_industry_entry, education_teaching, environmental_science

4. SKILLS (Concrete capabilities to develop):
- programming_languages, ai_machine_learning, data_science_analytics, web_development
- advanced_mathematics, statistics_data_analysis, financial_analysis
- biology_mastery, chemistry_mastery, physics_mastery, scientific_method
- public_communication, leadership_management, business_fundamentals
- creative_writing, technical_writing, project_management, foreign_language

CONVERSATION HISTORY ANALYSIS RULES:
- Look for CONSISTENCY: If student mentions similar interests across multiple responses, increase confidence
- Identify EVOLVING THEMES: Track how their goals develop or get more specific throughout conversation
- Find CONNECTIONS: Link related responses (e.g., "wants to be doctor" + "loves biology" = higher biology_mastery score)
- Avoid CONTRADICTIONS: If new response conflicts with previous ones, weight more recent responses higher
- Consider INTENSITY: Passionate or detailed responses about topics should get higher percentages
- Build COMPREHENSIVE PROFILE: Use full context to extract implied interests even if not directly stated

SCORING BASED ON CONVERSATION PATTERNS:
- High confidence (85-95%): Explicitly stated multiple times OR single passionate detailed response
- Medium-high confidence (70-84%): Clearly implied by multiple responses OR explicitly stated once
- Medium confidence (55-69%): Logically connected to stated goals OR mentioned briefly
- Lower confidence (40-54%): Weakly implied OR contradicted by other responses

EXAMPLES OF CONVERSATION-BASED ANALYSIS:

Pattern Recognition:
If student says "I want to be a doctor" (Q1) → "I love biology class" (Q3) → "I want to do medical research" (Q5):
- medical_school_path: 95% (stated multiple times)
- medicine_research: 90% (specific interest)
- biology_mastery: 85% (supports medical goals)

Evolution Tracking:
If student says "maybe business" (Q2) → "definitely entrepreneurship" (Q4) → "I want to start a tech company" (Q6):
- startup_founding: 90% (evolved to specific goal)
- entrepreneurship_business: 95% (reinforced theme)
- software_technology: 75% (tech company context)

For each category, provide JSON with:
- category_name: specific category from lists above
- percentage: 0-100 likelihood/interest score (use full conversation context)
- confidence: 0-100 confidence in assessment (higher if supported by multiple responses)

IMPORTANT: Analyze the CURRENT response in context of the FULL conversation. Extract all relevant categories even if they weren't the focus of the current question.

Example response format:
{
  "milestone_goals": [
    {"category_name": "startup_founding", "percentage": 85, "confidence": 90}
  ],
  "intermediate_milestones": [
    {"category_name": "academic_record_enhancement", "percentage": 80, "confidence": 85}
  ],
  "skills": [
    {"category_name": "programming_languages", "percentage": 75, "confidence": 80}
  ],
  "sectors": [
    {"category_name": "software_technology", "percentage": 85, "confidence": 90}
  ]
}

Return empty object {} only if response contains no goal-relevant information AND no patterns emerge from conversation history.`;

// ================================================================================================
// STRUCTURED CONVERSATION FUNCTIONS
// ================================================================================================

/**
 * Get current conversation status for display
 */
function getConversationStatus() {
    const currentCategory = CATEGORIES[currentCategoryIndex];
    const progress = `${totalQuestionsAsked}/16`;
    const categoryProgress = `${questionsInCategory + 1}/4`;
    
    return {
        category: currentCategory,
        categoryProgress: categoryProgress,
        totalProgress: progress,
        isComplete: totalQuestionsAsked >= 16
    };
}

/**
 * Generate strategic question based on current category and position
 */
async function getConversationResponse(userInput, isFirstQuestion = false) {
    try {
        const status = getConversationStatus();
        
        if (status.isComplete) {
            return "Interview complete! You've shared amazing insights about your goals. Type 'extract data' to save everything.";
        }

        let specificPrompt;
        
        // Format conversation history for context (limit to prevent token overflow)
        const recentHistory = conversationHistory.slice(-10); // Last 10 exchanges
        const historyText = recentHistory.length > 0 ? 
            `\nCONVERSATION HISTORY:\n${recentHistory.map(msg => `${msg.role === 'user' ? 'Student' : 'Counselor'}: ${msg.content}`).join('\n')}\n` : 
            '\nCONVERSATION HISTORY: [This is the start of the conversation]\n';
        
        if (isFirstQuestion) {
            specificPrompt = `This is question 1 of 16 in the MILESTONE_GOALS category. Ask about their biggest goals for the next 2-10 years. Include specific examples in parentheses to help guide them, such as: (getting into specific colleges, pursuing certain careers, starting a business, graduate school plans, earning scholarships, etc.). Be enthusiastic, engaging, and add your own natural conversational style while covering these key areas.${historyText}`;
        } else {
            // Check if we need to transition categories
            if (questionsInCategory === 0 && totalQuestionsAsked > 0) {
                // First question of a new category - announce transition
                const categoryNames = {
                    'INTERMEDIATE_MILESTONES': 'intermediate milestones',
                    'SECTORS': 'specific sectors and fields',
                    'SKILLS': 'key skills to develop'
                };
                
                const transitionText = categoryNames[status.category] || 'the next category';
                specificPrompt = `You are transitioning to the ${status.category} category. Announce the transition by saying "Now let's explore your ${transitionText}" and then ask your first question in this category. The student just said: "${userInput}"${historyText}`;
            } else {
                // Continue within current category
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
            model: 'gpt-4',
            messages: messages,
            max_tokens: 150,
            temperature: 0.3
        });

        const aiResponse = response.choices[0].message.content;
        
        // Store conversation
        if (!isFirstQuestion) {
            conversationHistory.push({ role: 'user', content: userInput });
            categoryResponses[CATEGORIES[currentCategoryIndex]].push(userInput);
        }
        conversationHistory.push({ role: 'assistant', content: aiResponse });

        return aiResponse;
    } catch (error) {
        console.error('Error getting conversation response:', error);
        const status = getConversationStatus();
        return `Question ${status.totalProgress}: What interests you most about your future goals?`;
    }
}

/**
 * Advance to next question and handle category transitions
 */
function advanceQuestion() {
    questionsInCategory++;
    totalQuestionsAsked++;
    
    // Check if we need to move to next category
    if (questionsInCategory >= 4 && currentCategoryIndex < CATEGORIES.length - 1) {
        currentCategoryIndex++;
        questionsInCategory = 0;
        console.log(`\n🔄 Moving to ${CATEGORIES[currentCategoryIndex]} (Questions ${totalQuestionsAsked + 1}-${Math.min(totalQuestionsAsked + 4, 16)})`);
    }
}

/**
 * Display progress indicator
 */
function displayProgress() {
    const status = getConversationStatus();
    const categoryName = status.category.replace('_', ' ');
    
    console.log(`\n📊 Progress: ${status.totalProgress} | Category: ${categoryName} (${status.categoryProgress})`);
    
    // Show category completion
    const completedCategories = CATEGORIES.slice(0, currentCategoryIndex);
    const currentCat = CATEGORIES[currentCategoryIndex];
    const remainingCategories = CATEGORIES.slice(currentCategoryIndex + 1);
    
    let progressBar = '';
    completedCategories.forEach(cat => progressBar += '✅ ');
    progressBar += `🔄 ${currentCat} (${questionsInCategory}/4) `;
    remainingCategories.forEach(cat => progressBar += '⏳ ');
    
    console.log(`Categories: ${progressBar}\n`);
}

// ================================================================================================
// DATA EXTRACTION AND STORAGE (same as original)
// ================================================================================================

async function getDataExtractionResponse(userInput) {
    try {
        // Format conversation history for analytical context
        const historyText = conversationHistory.length > 0 ? 
            `\nFULL CONVERSATION CONTEXT:\n${conversationHistory.map(msg => `${msg.role === 'user' ? 'Student' : 'Counselor'}: ${msg.content}`).join('\n')}\n` : 
            '\nCONVERSATION CONTEXT: [This is the first response]\n';

        // Include category context for better analysis
        const currentCategory = CATEGORIES[currentCategoryIndex];
        const categoryContext = `\nCURRENT INTERVIEW CONTEXT:\n- Category: ${currentCategory}\n- Question ${totalQuestionsAsked + 1}/16\n- Category Progress: ${questionsInCategory + 1}/4\n`;

        // Include previous extractions for consistency
        const previousExtractions = extractedDataHistory.length > 0 ? 
            `\nPREVIOUS EXTRACTIONS:\n${extractedDataHistory.slice(-3).map(extraction => 
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
            model: 'gpt-4',
            messages: messages,
            max_tokens: 600, // Increased for more comprehensive analysis
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

async function createStudent(name, email) {
    try {
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
        
        console.log(`Student created successfully! ID: ${currentStudentId}`);
        return true;
    } catch (error) {
        console.error('Error creating student:', error);
        return false;
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

        console.log('💾 Data extracted and saved to database');
    } catch (error) {
        console.error('Error saving extracted data:', error);
    }
}

async function extractStudentDataToFile() {
    if (!currentStudentId) {
        console.log('❌ No active student session to extract data from');
        return;
    }

    try {
        const dataFolder = path.join(__dirname, 'data');
        if (!fs.existsSync(dataFolder)) {
            fs.mkdirSync(dataFolder);
        }

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
                interview_structure: '4x4 structured (16 questions total)',
                questions_completed: totalQuestionsAsked
            },
            structured_responses: categoryResponses,
            conversation_history: conversationHistory,
            extracted_data_history: extractedDataHistory,
            database_data: {
                milestone_goals: milestoneGoals.data || [],
                intermediate_milestones: intermediateMilestones.data || [],
                skills: skills.data || [],
                sectors: sectors.data || []
            },
            summary: {
                total_categories_identified: (milestoneGoals.data?.length || 0) + 
                                           (intermediateMilestones.data?.length || 0) + 
                                           (skills.data?.length || 0) + 
                                           (sectors.data?.length || 0),
                conversation_length: conversationHistory.length,
                interview_completion: `${totalQuestionsAsked}/16 questions`
            }
        };

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `structured_interview_${currentStudentId}_${currentStudentName}_${timestamp}.json`;
        const filepath = path.join(dataFolder, filename);

        fs.writeFileSync(filepath, JSON.stringify(studentData, null, 2));
        
        console.log(`\n✅ Student data extracted successfully!`);
        console.log(`📁 File saved: ${filepath}`);
        console.log(`📊 Summary:`);
        console.log(`   - Student: ${currentStudentName} (ID: ${currentStudentId})`);
        console.log(`   - Interview Progress: ${totalQuestionsAsked}/16 questions`);
        console.log(`   - Categories Identified: ${studentData.summary.total_categories_identified}`);
        console.log(`   - Data Extractions: ${studentData.summary.data_extraction_events || extractedDataHistory.length}`);
        
        return filepath;
    } catch (error) {
        console.error('Error extracting student data:', error);
        return null;
    }
}

// ================================================================================================
// STRUCTURED CONVERSATION LOOP
// ================================================================================================

async function structuredConversationLoop() {
    console.log('\n🎯 Starting Structured 16-Question Interview');
    console.log('📋 Format: 4 questions each for MILESTONE GOALS → INTERMEDIATE MILESTONES → SECTORS → SKILLS\n');

    // Start with first question
    const openingResponse = await getConversationResponse("", true);
    displayProgress();
    console.log(`Counselor: ${openingResponse}\n`);

    while (totalQuestionsAsked < 16) {
        try {
            const userInput = await new Promise((resolve) => {
                rl.question('You: ', resolve);
            });

            // Check for exit command
            if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
                console.log('\n👋 Thanks! Your partial data has been saved. Good luck with your goals!');
                await extractStudentDataToFile();
                break;
            }

            // Check for data extraction command
            if (userInput.toLowerCase() === 'extract data') {
                await extractStudentDataToFile();
                continue;
            }

            // Advance question counter
            advanceQuestion();

            // Get conversation AI response
            const conversationResponse = await getConversationResponse(userInput, false);
            
            // Extract and save data
            const extractedData = await getDataExtractionResponse(userInput);
            if (extractedData) {
                extractedDataHistory.push({
                    timestamp: new Date().toISOString(),
                    question_number: totalQuestionsAsked,
                    category: CATEGORIES[currentCategoryIndex],
                    user_input: userInput,
                    extracted_data: extractedData
                });
                
                await saveExtractedData(extractedData);
            }

            // Display progress and next question
            displayProgress();
            console.log(`Counselor: ${conversationResponse}\n`);

        } catch (error) {
            console.error('Error in conversation loop:', error);
            console.log('Let\'s continue. What were you saying?');
        }
    }

    // Interview complete
    if (totalQuestionsAsked >= 16) {
        console.log('\n🎉 Structured Interview Complete!');
        console.log('📊 All 16 questions have been answered across all 4 categories.');
        console.log('💾 Automatically extracting your complete profile...\n');
        await extractStudentDataToFile();
    }

    rl.close();
}

// ================================================================================================
// APPLICATION ENTRY POINT
// ================================================================================================

async function startStructuredInterview() {
    console.log('\n🎓 UltraIntelligence Student Counselor - Structured Interview');
    console.log('================================================================\n');
    console.log('📋 This is a structured 16-question interview (4 questions per category):');
    console.log('   1️⃣  MILESTONE GOALS (Questions 1-4): Your big 5-10 year dreams');
    console.log('   2️⃣  INTERMEDIATE MILESTONES (Questions 5-8): Your 1-2 year stepping stones');
    console.log('   3️⃣  SECTORS (Questions 9-12): Industries and fields that interest you');
    console.log('   4️⃣  SKILLS (Questions 13-16): Concrete capabilities to develop');
    console.log('\n💡 Type "extract data" anytime to save your progress\n');

    // Get student information
    const name = await new Promise((resolve) => {
        rl.question('What is your name? ', resolve);
    });

    const email = await new Promise((resolve) => {
        rl.question('What is your email? ', resolve);
    });

    // Create student in database
    const success = await createStudent(name, email);
    if (!success) {
        console.log('❌ Failed to create student. Exiting...');
        process.exit(1);
    }

    // Start structured interview
    await structuredConversationLoop();
}

// ================================================================================================
// MODULE EXPORTS AND EXECUTION
// ================================================================================================

if (require.main === module) {
    startStructuredInterview().catch(console.error);
}

module.exports = {
    getConversationResponse,
    getDataExtractionResponse,
    saveExtractedData,
    createStudent,
    extractStudentDataToFile,
    getConversationStatus,
    advanceQuestion
};
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize OpenAI client for dual AI system
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Initialize Supabase client for data persistence
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ================================================================================================
// COMPREHENSIVE DATA EXTRACTION SYSTEM PROMPTS
// ================================================================================================

// Data Extraction AI: Analyzes responses using goal hierarchy framework
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

BINARY + STACK RANKING APPROACH:

STEP 1 - BINARY DECISION: For each category, decide YES or NO
- YES: This clearly applies to this student based on their responses
- NO: This does not apply or was not mentioned

STEP 2 - STACK RANKING: For all YES categories, rank them 1, 2, 3, etc.
- Lower numbers = higher importance/strength (1 is most important)
- Rank based on how strongly expressed or central to their goals
- Use the existing percentage field to store the ranking number

For each category, provide JSON with:
- category_name: specific category from lists above  
- percentage: ranking number (1, 2, 3, etc.) where 1 = highest priority/most important
- confidence: 0-100 confidence in the YES/NO decision

IMPORTANT: Only include categories that get a YES decision. Do not include categories that are NO.

IMPORTANT: Focus on the goal hierarchy. If student mentions big goals, always extract implied intermediate milestones and required skills even if not explicitly stated.

Example response format:
{
  "milestone_goals": [
    {"category_name": "startup_founding", "percentage": 1, "confidence": 90},
    {"category_name": "top_10_university_acceptance", "percentage": 2, "confidence": 85}
  ],
  "intermediate_milestones": [
    {"category_name": "academic_record_enhancement", "percentage": 1, "confidence": 85},
    {"category_name": "research_project_development", "percentage": 2, "confidence": 80}
  ],
  "skills": [
    {"category_name": "programming_languages", "percentage": 1, "confidence": 80},
    {"category_name": "business_fundamentals", "percentage": 2, "confidence": 75}
  ],
  "sectors": [
    {"category_name": "software_technology", "percentage": 1, "confidence": 90}
  ]
}

Return empty object {} only if response contains no goal-relevant information.`;

// ================================================================================================
// DATA EXTRACTION FUNCTIONS
// ================================================================================================

/**
 * Get response from Data Extraction AI - Analyzes and categorizes student responses
 * @param {string} userInput - Student's response to analyze OR full conversation history
 * @returns {Object|null} Extracted data in structured format or null if no data
 */
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
        
        // Try to parse the JSON response
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

/**
 * Comprehensive data extraction from full conversation history
 * This is the main function called when the summary button is clicked
 */
async function extractComprehensiveData(conversationHistory, sessionInfo = {}) {
    try {
        console.log('🔍 Starting comprehensive data extraction...');
        
        // Format conversation history for analysis
        const historyText = conversationHistory.length > 0 ? 
            conversationHistory.map(msg => `${msg.role === 'user' ? 'Student' : 'Counselor'}: ${msg.content}`).join('\n') : 
            'No conversation history available';

        // Use the same extraction function but with full conversation context
        const extractedData = await getDataExtractionResponse(`Full conversation context: ${historyText}`);
        
        if (extractedData) {
            console.log('✅ Successfully extracted comprehensive data');
            return extractedData;
        } else {
            console.log('❌ No data extracted from conversation');
            return null;
        }
    } catch (error) {
        console.error('❌ Error in comprehensive data extraction:', error);
        return null;
    }
}

/**
 * Save extracted data to Supabase database across multiple tables
 * @param {number} studentId - Student ID
 * @param {Object} extractedData - Categorized data from AI extraction
 */
async function saveExtractedData(studentId, extractedData) {
    if (!extractedData || !studentId) return;

    // Check if there's any actual data to save
    const hasData = (extractedData.milestone_goals && extractedData.milestone_goals.length > 0) ||
                   (extractedData.intermediate_milestones && extractedData.intermediate_milestones.length > 0) ||
                   (extractedData.skills && extractedData.skills.length > 0) ||
                   (extractedData.sectors && extractedData.sectors.length > 0);

    if (!hasData) {
        console.log('Data extracted, no data worth saving to database');
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
                        percentage: goal.percentage
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
                        percentage: milestone.percentage
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
                        percentage: skill.percentage
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
                        percentage: sector.percentage
                    }, { onConflict: 'student_id,category_name' });
            }
        }

        console.log('Data extracted and saved to database');
    } catch (error) {
        console.error('Error saving extracted data:', error);
    }
}

/**
 * Save comprehensive extracted data to Supabase (wrapper function)
 */
async function saveComprehensiveData(studentId, extractedData, sessionInfo = {}) {
    await saveExtractedData(studentId, extractedData);
    return true;
}

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
 * Extract data to file (enhanced version)
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
                conversation_structure: 'Goal identification + Strategic counseling + Comprehensive extraction'
            },
            identified_milestone_goals: session.identifiedMilestones || [],
            extracurriculars: session.extracurriculars || [],
            conversation_history: session.conversationHistory,
            extracted_data_history: session.extractedDataHistory || [],
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

module.exports = {
    getDataExtractionResponse,
    extractComprehensiveData,
    saveExtractedData,
    saveComprehensiveData,
    getComprehensiveStudentData,
    extractStudentDataToFile
};

# UltraIntelligence Student Counselor Chatbot

A terminal-based chatbot system that uses **two AI models** to provide student counseling while simultaneously extracting and categorizing student data into a structured database.

**NEW: Beautiful React UI Available!** 🎨

## 🎯 What This System Does

This system addresses the problem of inconsistent AI recommendations by using a **dual AI approach**:

1. **Conversation AI**: Has natural, engaging conversations with students about their goals
2. **Data Extraction AI**: Analyzes every student response and categorizes it into predefined pathways with percentage scores

Instead of asking "what should this student do?", the system asks "does this student show indicators for pathway X, Y, or Z?" and generates concrete percentage scores.

## 🏗️ System Architecture

### Two AI Models Working Together

- **Conversation AI (GPT-4)**: Handles the human-like conversation flow
- **Data Extraction AI (GPT-4)**: Analyzes responses and categorizes into 4 main areas:
  - **Milestone Goals** (Long-term, 2-10 years)
  - **Intermediate Milestones** (3 months-2 years)  
  - **Skills** (Concrete capabilities to develop)
  - **Sectors** (Professional fields and industries)

### Database Structure

- **students**: Basic student info (name, email, exploration_openness)
- **milestone_goals**: Long-term academic/career goals
- **intermediate_milestones**: Short-term actionable steps
- **skills**: Specific skills and competencies
- **sectors**: Industry and field interests

## 🚀 Quick Start

### Option 1: Terminal Interface (Original)
```bash
npm install
npm run setup-db
npm start
```

### Option 2: Beautiful React UI (Recommended) 🎨
```bash
# Install all dependencies
npm install

# Start both backend and frontend simultaneously
npm run dev-full

# Or use the convenient startup script
start-ui.bat
```

**The React UI provides:**
- ✨ Elegant dark theme with smooth animations
- 📱 Responsive design for all devices
- ⚡ Real-time progress bars and loading animations
- 💬 Modern chat interface with typing indicators
- 🎯 Interactive suggestion buttons
- 🚀 Beautiful progress tracking

## 💬 How It Works

1. **Student Onboarding**: System asks for name and email, creates student record
2. **Focused Assessment**: AI asks 11 targeted questions to gather key profile data
3. **Automatic Data Extraction**: Every student response is analyzed by Data Extraction AI
4. **Structured Storage**: Extracted data is automatically saved to appropriate database tables
5. **Profile Building**: System builds comprehensive student profiles with concrete data
6. **Data Export**: Type "extract data" to save complete session data to JSON files

## 🔍 Example Data Extraction

**Student says**: "I really want to get into a top 20 university and I'm interested in computer science and AI"

**Data Extraction AI outputs**:
```json
{
  "milestone_goals": [
    {"category_name": "top_20_university_acceptance", "percentage": 85, "confidence": 90}
  ],
  "skills": [
    {"category_name": "computer_science", "percentage": 90, "confidence": 95}
  ],
  "sectors": [
    {"category_name": "artificial_intelligence", "percentage": 80, "confidence": 85}
  ]
}
```

## 🎯 Focused Assessment Questions

The system efficiently gathers key profile data through 11 targeted questions:

1. **GPA** - Current academic performance
2. **Test Scores** - SAT/ACT results
3. **Grade Level** - Current academic year
4. **Location** - State/country for opportunity context
5. **Extracurriculars** - Current involvement and leadership
6. **Awards** - Recognition and achievements
7. **Subject Interests** - Top 3 academic interests
8. **Research Experience** - Any research background
9. **Coding Experience** - Programming and technical skills
10. **Career Field** - Primary career interest
11. **Primary Goal** - Biggest academic/career objective

## 📁 Data Export Feature

Type **"extract data"** during any conversation to save a comprehensive JSON file containing:

- **Student Information**: ID, name, email, session date
- **Complete Conversation History**: Every question and AI response
- **Extracted Data History**: All AI categorization events with timestamps
- **Database Data**: Current milestone goals, intermediate milestones, skills, and sectors
- **Session Summary**: Total categories identified, conversation length, extraction events

**Example JSON Structure**:
```json
{
  "student_info": {
    "id": 1,
    "name": "Sarah",
    "email": "sarah@example.com",
    "session_date": "2025-08-21T22:57:00.000Z",
    "total_conversation_turns": 8
  },
  "conversation_history": [...],
  "extracted_data_history": [...],
  "student_profile": {
    "demographics": {"location": "California"},
    "academics": {"gpa": "3.9", "test_scores": "SAT 1480", "grade": "11th grade"},
    "extracurriculars": ["Science Olympiad captain", "hospital volunteer", "debate team"],
    "awards": ["Science Olympiad state champion", "AP Scholar with Distinction"],
    "interests": ["biology", "chemistry", "computer science"],
    "progress": {"research_experience": "None yet", "coding_experience": "Basic Python"},
    "goals": {"primary_goal": "Get into top medical school"}
  },
  "database_data": {
    "milestone_goals": [...],
    "intermediate_milestones": [...],
    "skills": [...],
    "sectors": [...]
  },
  "summary": {
    "total_categories_identified": 12,
    "conversation_length": 16,
    "data_extraction_events": 8
  }
}
```

Files are saved in the `data/` folder with timestamps: `student_1_Sarah_2025-08-21T22-57-00-000Z.json`

## 📊 Predefined Categories

The system uses **200+ predefined categories** across the 4 main areas, ensuring consistent categorization instead of random AI-generated recommendations.

### Key Benefits:
- **Consistency**: Same student responses always map to same categories
- **Measurability**: Concrete percentage scores instead of vague suggestions
- **Actionability**: Clear pathways with specific milestones and skills
- **Scalability**: Structured data enables analytics and trend analysis

## 🛠️ Technical Details

- **Runtime**: Node.js with terminal interface
- **AI Models**: OpenAI GPT-4 for both conversation and data extraction
- **Database**: Supabase (PostgreSQL) with automatic schema management
- **Architecture**: Modular design with separate concerns for conversation vs. data extraction

## 🔧 Configuration

### Environment Variables

Before running the system, you need to create a `.env` file in the root directory with your API keys:

```bash
# Create .env file
OPENAI_API_KEY=your_openai_api_key_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_anon_key_here
```

**Important**: Never commit your `.env` file to version control. It's already included in `.gitignore`.

### Getting API Keys

1. **OpenAI API Key**: Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. **Supabase**: Create a project at [Supabase](https://supabase.com) and get your project URL and anon key

The system is pre-configured with:
- Comprehensive category mappings
- Default exploration openness settings
- Database schema management

## 📝 Usage Examples

### Starting a Session
```
🎓 Welcome to UltraIntelligence Student Counselor!
================================================

What is your name? Sarah
What is your email? sarah@example.com

✅ Student created successfully! ID: 2

👋 Hi Sarah! I'm here to efficiently assess your profile for college, research, and career opportunities.
Let me gather some key information to help evaluate your competitiveness.

What's your current GPA? (e.g., 3.8)
You: 3.9

What are your SAT/ACT scores? (e.g., SAT 1450, ACT 32)
You: SAT 1480

What grade are you in? (e.g., 11th grade)
You: 11th grade
```

### During Assessment
```
🤖 Counselor: Excellent GPA! That puts you in a strong position for competitive universities.

What extracurriculars are you currently involved in? (List them briefly)
You: Science Olympiad captain, hospital volunteer, debate team

🤖 Counselor: Strong leadership roles. Your hospital experience aligns well with medical goals.

What awards or recognition have you received? (List them briefly)
You: Science Olympiad state champion, AP Scholar with Distinction

✅ Data extracted and saved to database
```

## 🎯 Commands

- **`extract data`**: Save all conversation history and extracted data to a JSON file in the `data/` folder
- **`exit` or `quit`**: End the session and save all data

## 🔮 Future Enhancements

- **Exploration Openness Detection**: Automatically assess student willingness to explore alternatives
- **Timeline Analysis**: Extract urgency and timeline indicators from responses
- **Confidence Scoring**: Track confidence levels in student goal clarity
- **Recommendation Engine**: Use extracted data to generate personalized action plans
- **Analytics Dashboard**: Visualize student progress and trends
- **Batch Data Processing**: Process multiple student sessions and generate comparative reports

## 🤝 Contributing

This system is designed to be easily extensible. The modular architecture allows for:
- Adding new categories
- Modifying AI prompts
- Integrating additional data sources
- Building web interfaces on top of the terminal system

---

**Built for UltraIntelligence** - Reducing AI recommendation inconsistency through structured categorization and dual AI architecture.

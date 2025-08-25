# UltraIntelligence Student Counselor System

An AI-powered student counseling system that conducts structured 16-question interviews to help students plan their academic and career goals.

## Features

- **Structured Interview Format**: 4 questions each for 4 categories (16 total questions)
- **Dual AI System**: One AI for conversation, another for data extraction
- **Goal Categories**: Milestone Goals, Intermediate Milestones, Sectors, and Skills
- **Data Persistence**: Saves to Supabase database and local JSON files
- **Web Interface**: Modern React frontend with real-time chat

## Project Structure

```
ultra-intelligence/
├── index.js              # Original CLI version
├── server.js             # Express API server (new)
├── frontend/             # React frontend (new)
│   ├── src/
│   │   ├── App.js        # Main React component
│   │   ├── App.css       # Styling
│   │   └── index.js      # React entry point
│   ├── public/
│   │   └── index.html    # HTML template
│   └── package.json      # Frontend dependencies
├── data/                 # Generated student data files
├── package.json          # Backend dependencies
└── README.md
```

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Supabase account and database
- OpenAI API key

## Environment Variables

Create a `.env` file in the root directory:

```env
OPENAI_API_KEY=your_openai_api_key_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_service_role_key_here
```

## Installation & Setup

### 1. Install Backend Dependencies

```bash
cd ultra-intelligence
npm install
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

### 3. Setup Database (if not already done)

```bash
npm run setup-db
```

## Running the System

### Option 1: Full Stack (Recommended)

Run both backend and frontend simultaneously:

```bash
npm run start-ui
```

This will start:
- Backend API server on port 3001
- Frontend React app on port 3000

### Option 2: Separate Terminals

**Terminal 1 - Backend:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

### Option 3: CLI Only (Original)

Run the original terminal-based version:

```bash
npm start
```

## Usage

### Web Interface (New)

1. Open your browser to `http://localhost:3000`
2. Enter your name and email
3. Start the structured interview
4. Answer 16 questions across 4 categories
5. Your data is automatically saved and extracted

### API Endpoints

- `POST /api/start-interview` - Start new interview session
- `POST /api/send-message` - Send message and get AI response
- `GET /api/status/:sessionId` - Get interview progress
- `POST /api/extract-data/:sessionId` - Extract data to file

## Interview Structure

The system asks exactly 4 questions in each category:

1. **MILESTONE GOALS** (Questions 1-4): Big 5-10 year ambitions
2. **INTERMEDIATE MILESTONES** (Questions 5-8): 1-2 year stepping stones
3. **SECTORS** (Questions 9-12): Professional fields and industries
4. **SKILLS** (Questions 13-16): Concrete capabilities to develop

## Data Output

- **Database**: All extracted data is saved to Supabase
- **JSON Files**: Complete interview data saved to `data/` folder
- **Real-time**: Progress tracked and displayed in the UI

## Development

### Backend Development

```bash
npm run server-dev  # Run with nodemon for auto-restart
```

### Frontend Development

```bash
cd frontend
npm start          # Start React dev server
npm run build      # Build for production
```

## Troubleshooting

- **Port Conflicts**: Change ports in `server.js` and `frontend/package.json`
- **Database Issues**: Check your Supabase credentials and database setup
- **OpenAI Errors**: Verify your API key and billing status

## License

MIT License - see LICENSE file for details.

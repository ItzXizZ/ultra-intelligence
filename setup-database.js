// Database Setup Script for UltraIntelligence Student Counselor
// Note: Run with 'npm run setup-db' to avoid deprecation warnings

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = 'https://xbxkyqeirfacbmwqmddm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhieGt5cWVpcmZhY2Jtd3FtZGRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4MTE0MDksImV4cCI6MjA3MTM4NzQwOX0.hDEg4SbpfIYHhMKILk61995jvXQiOKfuG2qz6bmUqRg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
    try {
        console.log('Setting up database...');

        // Drop existing tables if they exist (in correct order due to dependencies)
        console.log('Dropping existing tables...');
        await supabase.rpc('exec_sql', { sql: 'DROP TABLE IF EXISTS sectors CASCADE;' });
        await supabase.rpc('exec_sql', { sql: 'DROP TABLE IF EXISTS skills CASCADE;' });
        await supabase.rpc('exec_sql', { sql: 'DROP TABLE IF EXISTS intermediate_milestones CASCADE;' });
        await supabase.rpc('exec_sql', { sql: 'DROP TABLE IF EXISTS milestone_goals CASCADE;' });
        await supabase.rpc('exec_sql', { sql: 'DROP TABLE IF EXISTS students CASCADE;' });

        // Create tables
        console.log('Creating students table...');
        await supabase.rpc('exec_sql', { sql: `
            CREATE TABLE students (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(255),
                exploration_openness VARCHAR(20) CHECK (exploration_openness IN ('low', 'medium', 'high')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `});

        console.log('Creating milestone_goals table...');
        await supabase.rpc('exec_sql', { sql: `
            CREATE TABLE milestone_goals (
                id SERIAL PRIMARY KEY,
                student_id INTEGER REFERENCES students(id),
                category_name VARCHAR(100) NOT NULL,
                percentage INTEGER CHECK (percentage >= 0 AND percentage <= 100),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, category_name)
            );
        `});

        console.log('Creating intermediate_milestones table...');
        await supabase.rpc('exec_sql', { sql: `
            CREATE TABLE intermediate_milestones (
                id SERIAL PRIMARY KEY,
                student_id INTEGER REFERENCES students(id),
                category_name VARCHAR(100) NOT NULL,
                percentage INTEGER CHECK (percentage >= 0 AND percentage <= 100),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, category_name)
            );
        `});

        console.log('Creating skills table...');
        await supabase.rpc('exec_sql', { sql: `
            CREATE TABLE skills (
                id SERIAL PRIMARY KEY,
                student_id INTEGER REFERENCES students(id),
                category_name VARCHAR(100) NOT NULL,
                percentage INTEGER CHECK (percentage >= 0 AND percentage <= 100),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, category_name)
            );
        `});

        console.log('Creating sectors table...');
        await supabase.rpc('exec_sql', { sql: `
            CREATE TABLE sectors (
                id SERIAL PRIMARY KEY,
                student_id INTEGER REFERENCES students(id),
                category_name VARCHAR(100) NOT NULL,
                percentage INTEGER CHECK (percentage >= 0 AND percentage <= 100),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, category_name)
            );
        `});

        // Create indexes for performance
        console.log('Creating indexes...');
        await supabase.rpc('exec_sql', { sql: 'CREATE INDEX idx_milestone_goals_student ON milestone_goals(student_id);' });
        await supabase.rpc('exec_sql', { sql: 'CREATE INDEX idx_milestone_goals_category ON milestone_goals(category_name);' });
        await supabase.rpc('exec_sql', { sql: 'CREATE INDEX idx_intermediate_milestones_student ON intermediate_milestones(student_id);' });
        await supabase.rpc('exec_sql', { sql: 'CREATE INDEX idx_intermediate_milestones_category ON intermediate_milestones(category_name);' });
        await supabase.rpc('exec_sql', { sql: 'CREATE INDEX idx_skills_student ON skills(student_id);' });
        await supabase.rpc('exec_sql', { sql: 'CREATE INDEX idx_skills_category ON skills(category_name);' });
        await supabase.rpc('exec_sql', { sql: 'CREATE INDEX idx_sectors_student ON sectors(student_id);' });
        await supabase.rpc('exec_sql', { sql: 'CREATE INDEX idx_sectors_category ON sectors(category_name);' });

        console.log('Database setup completed successfully!');
        
    } catch (error) {
        console.error('Error setting up database:', error);
    }
}

// Run setup if this file is executed directly
if (require.main === module) {
    setupDatabase();
}

module.exports = { setupDatabase };

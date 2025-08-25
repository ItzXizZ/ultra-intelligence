-- Updated Student Scoring System with all form fields
-- Clean separation of the 4 main categories by student

-- Drop existing tables if they exist (in correct order due to dependencies)
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS milestone_goals CASCADE;
DROP TABLE IF EXISTS intermediate_milestones CASCADE;
DROP TABLE IF EXISTS skills CASCADE;
DROP TABLE IF EXISTS sectors CASCADE;
DROP TABLE IF EXISTS extracurriculars CASCADE;

-- Main student table with all form fields
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(255),
    age VARCHAR(10),
    location VARCHAR(255),
    highschool VARCHAR(255),
    gpa DECIMAL(3,2),
    satscore VARCHAR(100),
    exploration_openness VARCHAR(20) CHECK (exploration_openness IN ('low', 'medium', 'high')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Milestone goals table
CREATE TABLE milestone_goals (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id),
    category_name VARCHAR(100) NOT NULL,
    percentage INTEGER CHECK (percentage >= 0 AND percentage <= 100),
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, category_name)
);

-- Intermediate milestone table
CREATE TABLE intermediate_milestones (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id),
    category_name VARCHAR(100) NOT NULL,
    percentage INTEGER CHECK (percentage >= 0 AND percentage <= 100),
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, category_name)
);

-- Skills table
CREATE TABLE skills (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id),
    category_name VARCHAR(100) NOT NULL,
    percentage INTEGER CHECK (percentage >= 0 AND percentage <= 100),
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, category_name)
);

-- Sector interests table
CREATE TABLE sectors (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id),
    category_name VARCHAR(100) NOT NULL,
    percentage INTEGER CHECK (percentage >= 0 AND percentage <= 100),
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, category_name)
);

-- Extracurriculars table
CREATE TABLE extracurriculars (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id),
    category_name VARCHAR(100) NOT NULL,
    description VARCHAR(1000) NOT NULL,
    title VARCHAR(100) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, category_name)
);

-- Indexes for performance
CREATE INDEX idx_milestone_goals_student ON milestone_goals(student_id);
CREATE INDEX idx_milestone_goals_category ON milestone_goals(category_name);
CREATE INDEX idx_intermediate_milestones_student ON intermediate_milestones(student_id);
CREATE INDEX idx_intermediate_milestones_category ON intermediate_milestones(category_name);
CREATE INDEX idx_skills_student ON skills(student_id);
CREATE INDEX idx_skills_category ON skills(category_name);
CREATE INDEX idx_sectors_student ON sectors(student_id);
CREATE INDEX idx_sectors_category ON sectors(category_name);
CREATE INDEX idx_extracurriculars_student ON extracurriculars(student_id);

-- Example data - Create Marcus as student
INSERT INTO students (name, email, age, location, highschool, gpa, satscore, exploration_openness) 
VALUES ('Marcus', 'marcus@example.com', '17', 'San Francisco, CA', 'Lincoln High School', 3.8, '1450', 'medium');

-- Marcus milestone goals (student_id = 1)
INSERT INTO milestone_goals (student_id, category_name, percentage) VALUES
(1, 'competitive_university_acceptance', 85),
(1, 'top_20_university_acceptance', 70),
(1, 'specialized_program_acceptance', 60),
(1, 'startup_founding', 60),
(1, 'profitable_business', 45),
(1, 'venture_capital_funding', 35);

-- Marcus intermediate milestones (student_id = 1)
INSERT INTO intermediate_milestones (student_id, category_name, percentage) VALUES
(1, 'college_application_completion', 85),
(1, 'academic_record_enhancement', 75),
(1, 'standardized_test_achievement', 70),
(1, 'competition_success', 65),
(1, 'leadership_position_development', 75),
(1, 'community_service_impact', 65),
(1, 'internship_work_experience', 90),
(1, 'professional_networking_exploration', 80),
(1, 'research_project_development', 50);

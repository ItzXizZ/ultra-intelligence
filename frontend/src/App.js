import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  // Session and student data
  const [sessionId, setSessionId] = useState(null);
  const [studentData, setStudentData] = useState({
    name: '',
    age: '',
    location: '',
    highschool: '',
    gpa: '',
    satAct: ''
  });

  // Conversation state
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Flow state
  const [currentStep, setCurrentStep] = useState('basic-info'); // basic-info, conversation, summary
  const [phase, setPhase] = useState('');
  const [summaryData, setSummaryData] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [extracurriculars, setExtracurriculars] = useState([]);
  
  // Modal states for extracurricular collection
  const [showYesNoButtons, setShowYesNoButtons] = useState(false);
  const [showECModal, setShowECModal] = useState(false);
  const [ecForm, setECForm] = useState({ title: '', description: '' });
  const [showAddMoreModal, setShowAddMoreModal] = useState(false);
  const [lastAddedTitle, setLastAddedTitle] = useState('');

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Submit basic info form
  const submitBasicInfo = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!studentData.name.trim() || !studentData.age.trim() || !studentData.location.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/submit-basic-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentData)
      });

      const data = await response.json();
      
      if (data.error) {
        alert('Error: ' + data.error);
        return;
      }

      setSessionId(data.sessionId);
      setPhase(data.phase);
      setMessages([{
        id: `counselor-${Date.now()}-init`,
        type: 'counselor',
        content: data.message,
        timestamp: new Date()
      }]);
              setCurrentStep('conversation');
    } catch (error) {
      console.error('Error submitting basic info:', error);
      alert('Failed to submit information. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Send message in conversation with streaming (updated for unified system)
  const sendMessage = async (e, autoMessage = null) => {
    if (e) e.preventDefault();
    
    const messageToSend = autoMessage || currentMessage.trim();
    if (!messageToSend || !sessionId) return;

    // Only show user message if not an auto-message and not a system trigger
    if (!autoMessage && messageToSend !== 'BEGIN_INTERMEDIATE_PHASE') {
      const userMessage = {
        id: `user-${Date.now()}-${Math.random()}`,
        type: 'user',
        content: messageToSend,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      setCurrentMessage('');
    }
    
    setIsLoading(true);

    // We'll create the counselor message only when we have actual content to display
    let counselorMessageId = null;
    let counselorMessageCreated = false;

    try {
      const response = await fetch('/api/send-message-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: messageToSend
        })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'content') {
                accumulatedContent += data.content;
                
                // Filter out phase signals and JSON from display
                let filteredContent = filterPhaseSignalsAndJSON(accumulatedContent);
                
                // Only create/update message if there's actual content to show (not just JSON fragments)
                if (filteredContent && filteredContent.trim().length > 0 && 
                    !filteredContent.match(/^\s*[\{\[\],\s]*$/)) {
                  
                  // Create the counselor message if we haven't already
                  if (!counselorMessageCreated) {
                    counselorMessageId = `counselor-${Date.now()}-${Math.random()}`;
                    const counselorMessage = {
                      id: counselorMessageId,
                      type: 'counselor',
                      content: filteredContent,
                      timestamp: new Date()
                    };
                    setMessages(prev => [...prev, counselorMessage]);
                    counselorMessageCreated = true;
                  } else {
                    // Update existing message
                    setMessages(prev => prev.map(msg => 
                      msg.id === counselorMessageId 
                        ? { ...msg, content: filteredContent }
                        : msg
                    ));
                  }
                }
              } else if (data.type === 'complete') {
                setPhase(data.phase);
                
                // Handle completion based on whether we created a message
                const filteredContent = filterPhaseSignalsAndJSON(accumulatedContent);
                if (counselorMessageCreated) {
                  // If we created a message, check if it should be removed or updated
                  if (!filteredContent || filteredContent.trim().length === 0 || 
                      filteredContent.match(/^\s*[\{\[\],\s]*$/)) {
                    console.log('🗑️ Removing empty/JSON-only message:', counselorMessageId);
                    setMessages(prev => prev.filter(msg => msg.id !== counselorMessageId));
                  } else {
                    // Final update with filtered content
                    setMessages(prev => prev.map(msg => 
                      msg.id === counselorMessageId 
                        ? { ...msg, content: filteredContent }
                        : msg
                    ));
                  }
                }
                // If no message was created, there's nothing to clean up
                
                // Check if this is an extracurricular question
                checkForExtracurricularQuestion(accumulatedContent);
                
                // Handle phase changes and auto-progression
                handlePhaseChange(accumulatedContent, data.phase);
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (parseError) {
              console.log('Non-JSON data received:', line);
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Error sending streaming message:', error);
      
      // Only add error message if we haven't created a counselor message yet
      if (!counselorMessageCreated) {
        setMessages(prev => [...prev, {
          id: `counselor-${Date.now()}-error`,
          type: 'counselor',
          content: 'Sorry, there was an error. Please try again.',
          timestamp: new Date()
        }]);
      } else {
        // If we created a message, remove it and add error message
        setMessages(prev => prev.filter(msg => msg.id !== counselorMessageId));
        setMessages(prev => [...prev, {
          id: `counselor-${Date.now()}-error`,
          type: 'counselor',
          content: 'Sorry, there was an error. Please try again.',
          timestamp: new Date()
        }]);
      }
    }
    
    setIsLoading(false);
  };

  // Check if AI is asking about extracurriculars
  const checkForExtracurricularQuestion = (content) => {
    const lowerContent = content.toLowerCase();
    
    // Look for extracurricular-related questions (but not if we're already in EC collection mode)
    if (!showECModal && !showAddMoreModal && !showYesNoButtons &&
        (lowerContent.includes('extracurricular') || 
        (lowerContent.includes('activities') && lowerContent.includes('goals')) ||
        lowerContent.includes('what extracurriculars have you participated'))) {
      console.log('🎯 Detected extracurricular question, showing Yes/No buttons');
      setShowYesNoButtons(true);
    }
  };

  // Filter out phase signals and JSON from display
  const filterPhaseSignalsAndJSON = (content) => {
    let filtered = content;
    
    // Remove phase completion signals
    filtered = filtered.replace(/<PHASE_COMPLETE>.*?<\/PHASE_COMPLETE>/g, '');
    filtered = filtered.replace(/<SESSION_COMPLETE>.*?<\/SESSION_COMPLETE>/g, '');
    
    // Remove JSON extraction data (comprehensive patterns)
    filtered = filtered.replace(/\{\s*"milestone_goals"[\s\S]*?\}\s*/g, '');
    filtered = filtered.replace(/\{\s*"intermediate_milestones"[\s\S]*?\}\s*/g, '');
    filtered = filtered.replace(/\{\s*"skills"[\s\S]*?\}\s*/g, '');
    filtered = filtered.replace(/\{\s*"sectors"[\s\S]*?\}\s*/g, '');
    
    // Remove any JSON structures (even partial ones)
    filtered = filtered.replace(/\{[\s\S]*?"ranking":\s*\d+[\s\S]*?\}/g, '');
    filtered = filtered.replace(/\{[\s\S]*?"category_name"[\s\S]*?\}/g, '');
    filtered = filtered.replace(/\{[\s\S]*?\[[\s\S]*?\][\s\S]*?\}/g, '');
    
    // Remove standalone JSON arrays and objects
    filtered = filtered.replace(/^\s*\{[\s\S]*?\}\s*$/gm, '');
    filtered = filtered.replace(/^\s*\[[\s\S]*?\]\s*$/gm, '');
    
    // Remove lines that are just JSON fragments
    filtered = filtered.replace(/^\s*[,\[\]{}]\s*$/gm, '');
    filtered = filtered.replace(/^\s*"[^"]*":\s*\[[\s\S]*?\]\s*$/gm, '');
    
    // Remove partial JSON patterns that appear at the end
    filtered = filtered.replace(/\],\s*"intermediate_milestones":\s*\[\s*\],\s*"skills":\s*\[\s*\],\s*"sectors":\s*\[[\s\S]*$/g, '');
    filtered = filtered.replace(/\],\s*"intermediate_milestones":\s*\[[\s\S]*$/g, '');
    filtered = filtered.replace(/\],\s*"skills":\s*\[[\s\S]*$/g, '');
    filtered = filtered.replace(/\],\s*"sectors":\s*\[[\s\S]*$/g, '');
    
    // Remove trailing JSON fragments
    filtered = filtered.replace(/\s*\]\s*,\s*"[^"]*"\s*:\s*\[[\s\S]*$/g, '');
    filtered = filtered.replace(/\s*\]\s*,[\s\S]*$/g, '');
    
    return filtered.trim();
  };

  // Handle phase changes and auto-progression
  const handlePhaseChange = (fullContent, newPhase) => {
    console.log('🔄 Checking phase signals in:', fullContent.substring(fullContent.length - 200));
    
    if (fullContent.includes('<PHASE_COMPLETE>MILESTONE_PHASE</PHASE_COMPLETE>')) {
      console.log('📍 Milestone phase completed, transitioning to intermediate goals...');
      setPhase('intermediate_goals');
      
      // Always auto-continue after milestone phase completion
      setTimeout(() => {
        console.log('🚀 Auto-continuing to intermediate phase');
        sendMessage(null, 'BEGIN_INTERMEDIATE_PHASE');
      }, 1500);
      
    } else if (fullContent.includes('<PHASE_COMPLETE>INTERMEDIATE_PHASE</PHASE_COMPLETE>')) {
      console.log('📍 Intermediate phase completed, starting extraction...');
      setPhase('extraction');
      
      // Auto-trigger extraction phase
      setTimeout(() => {
        sendMessage(null, 'begin extraction');
      }, 1500);
      
    } else if (fullContent.includes('<PHASE_COMPLETE>EXTRACTION_PHASE</PHASE_COMPLETE>')) {
      console.log('📍 Extraction phase completed, processing data...');
      setPhase('completion');
      
      // Extract and save JSON data
      const jsonMatch = fullContent.match(/\{[\s\S]*?"sectors"[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          const extracted = JSON.parse(jsonMatch[0]);
          setExtractedData(extracted);
          console.log('📊 Data extracted:', extracted);
        } catch (error) {
          console.error('Error parsing extracted data:', error);
        }
      }
      
      // Auto-complete session
      setTimeout(() => {
        sendMessage(null, 'complete session');
      }, 1500);
      
    } else if (fullContent.includes('<SESSION_COMPLETE>GOAL_IDENTIFICATION_FINISHED</SESSION_COMPLETE>')) {
      console.log('✅ Session completed successfully');
      setPhase('completed');
      
      // Auto-generate summary
      setTimeout(() => {
        extractData();
      }, 2000);
    }
  };

  // Progress indicator functions
  const getPhaseDisplayName = (currentPhase) => {
    switch(currentPhase) {
      case 'milestone_identification':
        return 'Identifying Long-term Goals';
      case 'intermediate_goals':
        return 'Exploring Intermediate Steps';
      case 'extraction':
        return 'Analyzing Your Goals';
      case 'completion':
        return 'Finalizing Assessment';
      case 'completed':
        return 'Assessment Complete';
      default:
        return 'Goal Identification';
    }
  };

  const getPhaseProgress = (currentPhase) => {
    switch(currentPhase) {
      case 'milestone_identification':
        return 25;
      case 'intermediate_goals':
        return 50;
      case 'extraction':
        return 75;
      case 'completion':
      case 'completed':
        return 100;
      default:
        return 0;
    }
  };

  // Handle Yes/No response for extracurriculars
  const handleECResponse = async (response) => {
    setIsLoading(true);
    setShowYesNoButtons(false);
    
    try {
      // Add user response to conversation
      const userMessage = {
        id: `user-${Date.now()}-ec-response`,
        type: 'user',
        content: response === 'yes' ? 'Yes, I\'d like to share my extracurriculars' : 'No, I\'d prefer to continue without sharing extracurriculars',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);

      if (response === 'yes') {
        // Show extracurricular collection modal
        setShowECModal(true);
        
        // Add counselor response
        const counselorMessage = {
          id: `counselor-${Date.now()}-ec-prompt`,
          type: 'counselor',
          content: 'Perfect! Please add your extracurricular activities one at a time. For each activity, provide a title and description.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, counselorMessage]);
      } else {
        // Continue with conversation - send the "no" response to unified system
        sendMessage(null, 'No, I\'d prefer to continue without sharing extracurriculars for now');
      }
      
    } catch (error) {
      console.error('Error handling EC response:', error);
      alert('Failed to process response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit individual extracurricular
  const submitExtracurricular = async () => {
    if (!ecForm.title.trim() || !ecForm.description.trim()) {
      alert('Please fill in both title and description');
      return;
    }

    setIsLoading(true);
    
    try {
      // Add to local state
      setExtracurriculars(prev => [...prev, {
        title: ecForm.title.trim(),
        description: ecForm.description.trim(),
        timestamp: new Date().toISOString()
      }]);

      // Store the title before resetting form
      const currentTitle = ecForm.title;
      
      // Reset form
      setECForm({ title: '', description: '' });
      
      // Close modal and show add more confirmation
      setShowECModal(false);
      setLastAddedTitle(currentTitle);
      setShowAddMoreModal(true);
      
    } catch (error) {
      console.error('Error submitting extracurricular:', error);
      alert('Failed to submit extracurricular. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle add more response
  const handleAddMoreResponse = (addMore) => {
    setShowAddMoreModal(false);
    if (addMore) {
      setShowECModal(true);
    } else {
      finishExtracurriculars();
    }
  };

  // Finish adding extracurriculars and continue conversation
  const finishExtracurriculars = async () => {
    setIsLoading(true);
    
    try {
      // Create well-formatted summary of extracurriculars
      const formattedECs = extracurriculars.map((ec, index) => 
        `${index + 1}. **${ec.title}**\n   ${ec.description}`
      ).join('\n\n');
      
      // Add nicely formatted summary message to conversation
      const summaryMessage = {
        id: `user-${Date.now()}-ec-summary`,
        type: 'user',
        content: `Here are my extracurricular activities:\n\n${formattedECs}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, summaryMessage]);

      // Send the extracurricular info to the unified system with special instruction
      const ecPrompt = `Here are my extracurricular activities:\n\n${formattedECs}\n\nPlease provide a very brief analysis of how these activities connect to my goals of top_10_university_acceptance and startup_founding, then complete the milestone phase.`;
      
      sendMessage(null, ecPrompt);
      
    } catch (error) {
      console.error('Error finishing extracurriculars:', error);
      alert('Failed to finish extracurriculars. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };



  // Handle form input changes
  const handleInputChange = (field, value) => {
    setStudentData(prev => ({
      ...prev,
      [field]: value
    }));
  };



  // Extract data and show summary
  const extractData = async () => {
    if (!sessionId) return;

    setIsLoading(true);
    try {
      // Call the comprehensive summary generation endpoint
      const response = await fetch(`/api/generate-summary/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.error) {
        alert('Error: ' + data.error);
        return;
      }

      // The new endpoint returns comprehensive data directly
      setSummaryData(data.comprehensiveData);
      setCurrentStep('summary');
      
      console.log('Summary generated successfully:', data.summary);
      
    } catch (error) {
      console.error('Error extracting data:', error);
      alert('Failed to extract data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset everything
  const resetApp = () => {
    setSessionId(null);
    setStudentData({
      name: '',
      age: '',
      location: '',
      highschool: '',
      gpa: '',
      satAct: ''
    });
    setMessages([]);
    setCurrentMessage('');
    setCurrentStep('basic-info');
    setExtracurriculars([]);
    setPhase('');
    setSummaryData(null);
    setShowYesNoButtons(false);
    setShowECModal(false);
    setShowAddMoreModal(false);
  };

  // Format milestone goals for display
  const formatGoalName = (goal) => {
    return goal.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Render basic info form
  if (currentStep === 'basic-info') {
    return (
      <div className="app">
        <div className="container">
          <div className="header">
            <h1>Ultra<span className="beta">beta</span></h1>
            <h2>Student Intelligence Platform</h2>
          </div>
          
          <form onSubmit={submitBasicInfo} className="form">
            <div className="form-section">
              <h3>Basic Information</h3>
              
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={studentData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter your full name"
                  required
                  disabled={isLoading}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Age *</label>
                  <input
                    type="number"
                    value={studentData.age}
                    onChange={(e) => handleInputChange('age', e.target.value)}
                    placeholder="16"
                    min="13"
                    max="25"
                    required
                    disabled={isLoading}
                  />
                </div>
                
                <div className="form-group">
                  <label>Location *</label>
                  <input
                    type="text"
                    value={studentData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="City, State"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>High School</label>
                <input
                  type="text"
                  value={studentData.highschool}
                  onChange={(e) => handleInputChange('highschool', e.target.value)}
                  placeholder="Your high school name (optional)"
                  disabled={isLoading}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>GPA</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="4.0"
                    value={studentData.gpa}
                    onChange={(e) => handleInputChange('gpa', e.target.value)}
                    placeholder="3.8 (optional)"
                    disabled={isLoading}
                  />
                </div>
                
                <div className="form-group">
                  <label>SAT/ACT Score</label>
                  <input
                    type="text"
                    value={studentData.satAct}
                    onChange={(e) => handleInputChange('satAct', e.target.value)}
                    placeholder="1450 SAT or 32 ACT"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
            
            <button type="submit" disabled={isLoading} className="primary-button">
              {isLoading ? (
                <div className="loading-spinner"></div>
              ) : (
                'Continue to Goal Planning'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render summary page
  if (currentStep === 'summary' && summaryData) {
    return (
      <div className="app">
        <div className="container summary-container">
          <div className="header">
            <h1>Ultra<span className="beta">beta</span></h1>
            <h2>Student Profile Summary</h2>
            <p>{summaryData.student_info.name} • {summaryData.student_info.age} years old • {summaryData.student_info.location}</p>
          </div>
          
          <div className="summary-content">




            <div className="summary-section">
              <h3>Milestone Goals Analysis</h3>
              <div className="goals-analysis">
                {summaryData.milestone_goals && summaryData.milestone_goals.length > 0 ? (
                  (summaryData.milestone_goals || [])
                    .sort((a, b) => a.percentage - b.percentage) // Sort by ranking (lower number = higher rank)
                    .map((goal, index) => (
                    <div key={index} className="goal-analysis-item ranking-item">
                      <div className="rank-number">#{goal.percentage}</div>
                      <div className="goal-name">{formatGoalName(goal.category_name)}</div>
                    </div>
                  ))
                ) : (
                  <p className="no-data">No milestone goals extracted yet. Continue the conversation to identify specific goals.</p>
                )}
              </div>
            </div>

            <div className="summary-section">
              <h3>Intermediate Milestones Analysis</h3>
              <div className="goals-analysis">
                {summaryData.intermediate_milestones && summaryData.intermediate_milestones.length > 0 ? (
                  (summaryData.intermediate_milestones || [])
                    .sort((a, b) => a.percentage - b.percentage) // Sort by ranking (lower number = higher rank)
                    .map((milestone, index) => (
                    <div key={index} className="goal-analysis-item ranking-item">
                      <div className="rank-number">#{milestone.percentage}</div>
                      <div className="goal-name">{formatGoalName(milestone.category_name)}</div>
                    </div>
                  ))
                ) : (
                  <p className="no-data">No intermediate milestones extracted yet. Continue the conversation to identify specific next steps.</p>
                )}
              </div>
            </div>

            <div className="summary-section">
              <h3>Skills Analysis</h3>
              <div className="goals-analysis">
                {summaryData.skills && summaryData.skills.length > 0 ? (
                  (summaryData.skills || [])
                    .sort((a, b) => a.percentage - b.percentage) // Sort by ranking (lower number = higher rank)
                    .map((skill, index) => (
                    <div key={index} className="goal-analysis-item ranking-item">
                      <div className="rank-number">#{skill.percentage}</div>
                      <div className="goal-name">{formatGoalName(skill.category_name)}</div>
                    </div>
                  ))
                ) : (
                  <p>No skills data available yet.</p>
                )}
              </div>
            </div>

            <div className="summary-section">
              <h3>Sector Interests Analysis</h3>
              <div className="goals-analysis">
                {summaryData.sectors && summaryData.sectors.length > 0 ? (
                  (summaryData.sectors || [])
                    .sort((a, b) => a.percentage - b.percentage) // Sort by ranking (lower number = higher rank)
                    .map((sector, index) => (
                    <div key={index} className="goal-analysis-item ranking-item">
                      <div className="rank-number">#{sector.percentage}</div>
                      <div className="goal-name">{formatGoalName(sector.category_name)}</div>
                    </div>
                  ))
                ) : (
                  <p>No sector data available yet.</p>
                )}
              </div>
            </div>

            <div className="summary-stats">
              <div className="stat-item">
                <span className="stat-value">{summaryData.conversation_length || 0}</span>
                <span className="stat-label">Conversation Messages</span>
              </div>

              <div className="stat-item">
                <span className="stat-value">
                  {(summaryData.milestone_goals?.length || 0) + (summaryData.intermediate_milestones?.length || 0)}
                </span>
                <span className="stat-label">Goals Identified</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{summaryData.skills?.length || 0}</span>
                <span className="stat-label">Skills Identified</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{summaryData.sectors?.length || 0}</span>
                <span className="stat-label">Sectors Identified</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{summaryData.extracted_data_history?.length || 0}</span>
                <span className="stat-label">Data Extractions</span>
              </div>
            </div>

            <div className="button-group">
              <button onClick={() => setCurrentStep('milestone-chat')} className="secondary-button">
                Continue Conversation
              </button>
              <button onClick={resetApp} className="primary-button">
                Start New Session
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Extract next steps based on conversation analysis
  const getAvailableFeatures = () => {
    // Only show features after meaningful conversation (at least 4 messages)
    if (!messages || messages.length < 4) {
      return [];
    }
    
    const conversationContent = messages.map(m => m.content).join(' ').toLowerCase();
    
    // College Application Support
    if (conversationContent.includes('college') || conversationContent.includes('university')) {
      return [
        { title: 'Chance Me Analysis', description: 'Comprehensive admission probability analysis for your target universities' },
        { title: 'College Application Roadmap', description: 'Complete timeline and strategy for maximizing admission success' },
        { title: 'Admissions Program Support', description: 'Essay writing guidance and Common App optimization' }
      ];
    }
    
    // Research & STEM
    if (conversationContent.includes('research') || conversationContent.includes('science')) {
      return [
        { title: 'Research Plan Development', description: 'Structured pathway to conducting and publishing research' },
        { title: 'Ultra Research Opportunities', description: 'Curated research positions and mentorship connections' }
      ];
    }
    
    // Skill Development
    if (conversationContent.includes('internship') || conversationContent.includes('experience')) {
      return [
        { title: 'Internship Opportunities', description: 'Targeted internship matching based on your interests and goals' },
        { title: 'Ultra Opportunities', description: 'Exclusive high-impact experiences for competitive students' }
      ];
    }
    
    // Test Prep
    if (conversationContent.includes('sat') || conversationContent.includes('test')) {
      return [
        { title: 'SAT Platform Access', description: 'Personalized test preparation and score improvement strategy' }
      ];
    }
    
    // Default exploration for unclear paths
    return [
      { title: 'Exploration Path', description: 'Structured approach to discovering your optimal career direction' }
    ];
  };

  // Render chat interface (milestone-chat or intermediate-chat)
  return (
    <div className="app">
      <div className="main-layout">
        <div className="chat-container">
          <div className="chat-header">
            <div className="header-content">
              <h1>Ultra<span className="beta">beta</span></h1>
              <div className="student-info">
                <span>{studentData.name}</span>
                <span>{studentData.age} years old</span>
                <span>{studentData.location}</span>
              </div>
              <div className="phase-container">
                <div className="phase-indicator">
                  {getPhaseDisplayName(phase)}
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${getPhaseProgress(phase)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div className="messages-container">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.type}`}>
                <div className="message-content">
                  {message.content}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="message counselor">
                <div className="message-content">
                  <div className="typing-indicator">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-container">
            {/* Yes/No buttons for extracurricular question */}
            {showYesNoButtons && (
              <div className="yes-no-container">
                <button 
                  onClick={() => handleECResponse('yes')} 
                  disabled={isLoading}
                  className="yes-button"
                >
                  Yes, I'd like to share
                </button>
                <button 
                  onClick={() => handleECResponse('no')} 
                  disabled={isLoading}
                  className="no-button"
                >
                  No, let's continue
                </button>
              </div>
            )}
            
            {/* Regular chat input (hidden when showing Yes/No buttons) */}
            {!showYesNoButtons && (
              <form onSubmit={sendMessage} className="chat-form">
                <input
                  type="text"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  placeholder="Type your response..."
                  disabled={isLoading || phase === 'completed'}
                  className="chat-input"
                />
                <button 
                  type="submit" 
                  disabled={isLoading || !currentMessage.trim() || phase === 'completed'}
                  className="send-button"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/>
                  </svg>
                </button>
              </form>
            )}
            
            <div className="chat-actions">
              <button 
                onClick={extractData} 
                disabled={!sessionId || isLoading}
                className="extract-button"
              >
                View Summary
              </button>
              <button onClick={resetApp} className="action-button">
                New Session
              </button>
            </div>
          </div>
        </div>
        
        {/* Available Features Panel */}
        <div className="features-panel">
          <div className="features-header">
            <h3>Available Ultra Features</h3>
            <div className="features-subtitle">
              {messages.length < 4 ? 'Continue sharing to unlock your personalized features' : 'Based on our conversation, you\'ll have access to:'}
            </div>
          </div>
          
          <div className="features-content">
            {getAvailableFeatures().length === 0 ? (
              <div className="features-empty">
                <div className="empty-message">Share more about your goals and interests to see which Ultra features will be available to you.</div>
              </div>
            ) : (
              <div className="features-list">
                {getAvailableFeatures().map((feature, index) => (
                  <div key={index} className="feature-item">
                    <h4 className="feature-title">{feature.title}</h4>
                    <p className="feature-description">{feature.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Extracurricular Modal */}
        {showECModal && (
          <div className="modal-overlay" onClick={() => setShowECModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Add Extracurricular Activity</h3>
                <button 
                  onClick={() => setShowECModal(false)}
                  className="modal-close"
                >
                  ×
                </button>
              </div>
              
              <div className="modal-body">
                <div className="form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    value={ecForm.title}
                    onChange={(e) => setECForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Robotics Club President, Math Tutoring, Research Project"
                    disabled={isLoading}
                  />
                </div>
                
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={ecForm.description}
                    onChange={(e) => setECForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your role, achievements, and impact..."
                    rows="4"
                    disabled={isLoading}
                  />
                </div>
                
                {extracurriculars.length > 0 && (
                  <div className="added-activities">
                    <h4>Added Activities ({extracurriculars.length})</h4>
                    {extracurriculars.map((ec, index) => (
                      <div key={index} className="activity-chip">
                        {ec.title}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="modal-footer">
                <button 
                  onClick={submitExtracurricular}
                  disabled={isLoading || !ecForm.title.trim() || !ecForm.description.trim()}
                  className="primary-button"
                >
                  {isLoading ? <div className="loading-spinner"></div> : 'Add Activity'}
                </button>
                
                {extracurriculars.length > 0 && (
                  <button 
                    onClick={finishExtracurriculars}
                    disabled={isLoading}
                    className="secondary-button"
                  >
                    Done Adding Activities
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Add More Confirmation Modal */}
        {showAddMoreModal && (
          <div className="modal-overlay">
            <div className="modal-content confirmation-modal">
              <div className="modal-header">
                <h3>Activity Added!</h3>
              </div>
              
              <div className="modal-body">
                <p>Successfully added "{lastAddedTitle}"!</p>
                <p>Would you like to add another extracurricular activity?</p>
              </div>
              
              <div className="modal-footer">
                <button 
                  onClick={() => handleAddMoreResponse(true)}
                  className="primary-button"
                >
                  Add Another
                </button>
                <button 
                  onClick={() => handleAddMoreResponse(false)}
                  className="secondary-button"
                >
                  I'm Done
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
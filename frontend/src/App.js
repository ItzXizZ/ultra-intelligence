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
  const [currentStep, setCurrentStep] = useState('basic-info'); // basic-info, milestone-chat, intermediate-chat, summary
  const [extracurriculars, setExtracurriculars] = useState([]);
  const [phase, setPhase] = useState('');
  const [summaryData, setSummaryData] = useState(null);
  
  // Modal state
  const [showECModal, setShowECModal] = useState(false);
  const [ecForm, setECForm] = useState({ title: '', description: '' });
  const [showYesNoButtons, setShowYesNoButtons] = useState(false);
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
        id: 1,
        type: 'counselor',
        content: data.message,
        timestamp: new Date()
      }]);
      setCurrentStep('milestone-chat');
    } catch (error) {
      console.error('Error submitting basic info:', error);
      alert('Failed to submit information. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Send message in conversation with streaming
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!currentMessage.trim() || !sessionId) return;

    const userMessage = {
      id: messages.length + 1,
      type: 'user',
      content: currentMessage.trim(),
      timestamp: new Date()
    };

    const messageToSend = currentMessage.trim();
    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);

    // Create a placeholder message for the AI response
    const counselorMessageId = messages.length + 2;
    const counselorMessage = {
      id: counselorMessageId,
      type: 'counselor',
      content: '',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, counselorMessage]);

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
                // Update the message in real-time
                setMessages(prev => prev.map(msg => 
                  msg.id === counselorMessageId 
                    ? { ...msg, content: accumulatedContent }
                    : msg
                ));
              } else if (data.type === 'complete') {
                // Update phase and other data when complete
                setPhase(data.phase);
                
                // Check if we should show Yes/No buttons for extracurriculars
                if (data.phase === 'extracurricular_question') {
                  setShowYesNoButtons(true);
                }
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
      // Fallback to non-streaming if streaming fails
      try {
        const fallbackResponse = await fetch('/api/send-message-new', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            message: messageToSend
          })
        });

        const fallbackData = await fallbackResponse.json();
        
        if (fallbackData.error) {
          alert('Error: ' + fallbackData.error);
          return;
        }

        // Update the message with fallback response
        setMessages(prev => prev.map(msg => 
          msg.id === counselorMessageId 
            ? { ...msg, content: fallbackData.message }
            : msg
        ));
        setPhase(fallbackData.phase);
        
        // Check if we should show Yes/No buttons for extracurriculars
        if (fallbackData.phase === 'extracurricular_question') {
          setShowYesNoButtons(true);
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        alert('Failed to send message. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Yes/No response for extracurriculars
  const handleECResponse = async (response) => {
    setIsLoading(true);
    setShowYesNoButtons(false);
    
    try {
      const apiResponse = await fetch('/api/extracurricular-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          response
        })
      });

      const data = await apiResponse.json();
      
      if (data.error) {
        alert('Error: ' + data.error);
        return;
      }

      // Add the response message
      const responseMessage = {
        id: messages.length + 1,
        type: 'counselor',
        content: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, responseMessage]);
      setPhase(data.phase);
      
      // If they said yes, show the modal for adding ECs
      if (response === 'yes') {
        setShowECModal(true);
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
      const response = await fetch('/api/submit-extracurricular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          title: ecForm.title.trim(),
          description: ecForm.description.trim()
        })
      });

      const data = await response.json();
      
      if (data.error) {
        alert('Error: ' + data.error);
        return;
      }

      // Add to local state
      setExtracurriculars(prev => [...prev, {
        title: ecForm.title.trim(),
        description: ecForm.description.trim()
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

  // Finish adding extracurriculars and move to intermediate goals
  const finishExtracurriculars = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/finish-extracurriculars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      const data = await response.json();
      
      if (data.error) {
        alert('Error: ' + data.error);
        return;
      }

      // Add the transition message
      const transitionMessage = {
        id: messages.length + 1,
        type: 'counselor',
        content: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, transitionMessage]);
      setPhase(data.phase);
      
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
              <h3>Identified Goals</h3>
              <div className="goals-display">
                {(summaryData.identified_milestones || []).map((goal, index) => (
                  <div key={index} className="goal-chip">
                    {formatGoalName(goal)}
                  </div>
                ))}
              </div>
            </div>

            <div className="summary-section">
              <h3>Extracurricular Activities</h3>
              <div className="activities-list">
                {(() => {
                  // Combine and deduplicate extracurriculars
                  const sessionECs = summaryData.extracurriculars || [];
                  const dbECs = summaryData.database_extracurriculars || [];
                  
                  // Create a map to deduplicate by title
                  const ecMap = new Map();
                  
                  // Add session ECs first (they're more recent)
                  sessionECs.forEach((ec, index) => {
                    ecMap.set(ec.title.toLowerCase(), {
                      ...ec,
                      source: 'Session',
                      key: `session-${index}`
                    });
                  });
                  
                  // Add database ECs only if not already present
                  dbECs.forEach((ec, index) => {
                    const key = ec.title.toLowerCase();
                    if (!ecMap.has(key)) {
                      ecMap.set(key, {
                        ...ec,
                        source: 'Database',
                        key: `db-${index}`
                      });
                    }
                  });
                  
                  const uniqueECs = Array.from(ecMap.values());
                  
                  if (uniqueECs.length === 0) {
                    return <p className="no-data">No extracurricular activities recorded</p>;
                  }
                  
                  return uniqueECs.map((ec) => (
                    <div key={ec.key} className="activity-item">
                      <h4>{ec.title}</h4>
                      <p>{ec.description}</p>
                      <span className="activity-source">{ec.source}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>

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
                  {(() => {
                    // Calculate deduplicated EC count
                    const sessionECs = summaryData.extracurriculars || [];
                    const dbECs = summaryData.database_extracurriculars || [];
                    const ecTitles = new Set();
                    
                    sessionECs.forEach(ec => ecTitles.add(ec.title.toLowerCase()));
                    dbECs.forEach(ec => ecTitles.add(ec.title.toLowerCase()));
                    
                    return ecTitles.size;
                  })()}
                </span>
                <span className="stat-label">Activities Shared</span>
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
  
  // Get conversation progress insights
  const getConversationInsights = () => {
    const totalWords = messages.reduce((count, msg) => count + msg.content.split(' ').length, 0);
    const avgWordsPerMessage = messages.length > 0 ? Math.round(totalWords / messages.length) : 0;
    const conversationDepth = messages.length > 10 ? 'Deep' : messages.length > 5 ? 'Moderate' : 'Getting Started';
    
    return {
      totalWords,
      avgWordsPerMessage,
      conversationDepth,
      phase: phase === 'milestone_identification' ? 'Goal Discovery' : 'Strategic Planning'
    };
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
              <div className="phase-indicator">
                {phase === 'milestone_identification' && 'Goal Identification'}
                {phase === 'intermediate_goals' && 'Strategic Planning'}
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
                  disabled={isLoading}
                  className="chat-input"
                />
                <button 
                  type="submit" 
                  disabled={isLoading || !currentMessage.trim()}
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
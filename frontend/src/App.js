import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  // Session and student data
  const [sessionId, setSessionId] = useState(null);
  const [studentData, setStudentData] = useState({
    name: '',
    age: '',
    location: '',
    highschool: ''
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
  
  // Todo state
  const [todos, setTodos] = useState([]);
  const [currentTodo, setCurrentTodo] = useState(null);
  
  // State for stored goals from database
  const [storedGoals, setStoredGoals] = useState({
    milestone_goals: [],
    intermediate_milestones: [],
    skills: [],
    sectors: []
  });
  
  // Modal states for extracurricular collection
  const [showYesNoButtons, setShowYesNoButtons] = useState(false);
  const [showECModal, setShowECModal] = useState(false);
  const [ecForm, setECForm] = useState({ title: '', description: '' });
  const [showAddMoreModal, setShowAddMoreModal] = useState(false);
  const [lastAddedTitle, setLastAddedTitle] = useState('');

  // Modal states for academic stats collection
  const [showAcademicYesNoButtons, setShowAcademicYesNoButtons] = useState(false);
  const [showAcademicModal, setShowAcademicModal] = useState(false);
  const [academicForm, setAcademicForm] = useState({ 
    currentGPA: '',
    satScore: '',
    actScore: '',
    apCourses: '',
    classRank: '',
    honors: '',
    additionalInfo: ''
  });
  const [academicStats, setAcademicStats] = useState([]);

  // Modal states for awards collection
  const [showAwardsYesNoButtons, setShowAwardsYesNoButtons] = useState(false);
  const [showAwardsModal, setShowAwardsModal] = useState(false);
  const [awardsForm, setAwardsForm] = useState({ title: '', description: '' });
  const [showAwardsAddMoreModal, setShowAwardsAddMoreModal] = useState(false);
  const [lastAddedAwardsTitle, setLastAddedAwardsTitle] = useState('');
  const [awards, setAwards] = useState([]);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch stored goals when session changes or todos update
  useEffect(() => {
    if (sessionId) {
      fetchStoredGoals();
    }
  }, [sessionId, todos]);

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
      
      // Initialize todos if provided
      if (data.todos) {
        setTodos(data.todos);
      }
      if (data.currentTodo) {
        setCurrentTodo(data.currentTodo);
      }
      
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
                
                // Update todos if provided
                if (data.todos) {
                  setTodos(data.todos);
                }
                if (data.currentTodo) {
                  setCurrentTodo(data.currentTodo);
                }
                
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
                
                // Check if this is an academic stats question
                checkForAcademicStatsQuestion(accumulatedContent);
                
                // Check if this is an awards question
                checkForAwardsQuestion(accumulatedContent);
                
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

  // Track if we've already handled extracurriculars, academic stats, and awards
  const [hasHandledExtracurriculars, setHasHandledExtracurriculars] = useState(false);
  const [hasHandledAcademicStats, setHasHandledAcademicStats] = useState(false);
  const [hasHandledAwards, setHasHandledAwards] = useState(false);
  
  // Track dropdown visibility for goals
  const [openDropdown, setOpenDropdown] = useState(null);

  // Check if AI is asking about extracurriculars (only once per session)
  const checkForExtracurricularQuestion = (content) => {
    const lowerContent = content.toLowerCase();
    
    // Only show EC question once per session and only in milestone phase
    if (!hasHandledExtracurriculars && !showECModal && !showAddMoreModal && !showYesNoButtons &&
        currentTodo && currentTodo.id === 'milestone_phase' &&
        (lowerContent.includes('what extracurriculars have you participated') ||
        (lowerContent.includes('extracurricular') && lowerContent.includes('goals')))) {
      console.log('🎯 Detected extracurricular question, showing Yes/No buttons');
      setShowYesNoButtons(true);
      setHasHandledExtracurriculars(true);
    }
  };

  // Check if AI is asking about academic stats (only once per session)
  const checkForAcademicStatsQuestion = (content) => {
    const lowerContent = content.toLowerCase();
    
    // Only show academic stats question once per session and only in milestone phase (after ECs)
    if (!hasHandledAcademicStats && !showAcademicModal && !showAcademicYesNoButtons &&
        currentTodo && currentTodo.id === 'milestone_phase' &&
        (lowerContent.includes('what academic stats') ||
        lowerContent.includes('academic achievements') ||
        (lowerContent.includes('academic') && (lowerContent.includes('performance') || lowerContent.includes('highlight'))))) {
      console.log('🎯 Detected academic stats question, showing Yes/No buttons');
      setShowAcademicYesNoButtons(true);
      setHasHandledAcademicStats(true);
    }
  };

  // Check if AI is asking about awards (only once per session)
  const checkForAwardsQuestion = (content) => {
    const lowerContent = content.toLowerCase();
    
    // Only show awards question once per session and only in milestone phase (after ECs and academic stats)
    if (!hasHandledAwards && !showAwardsModal && !showAwardsAddMoreModal && !showAwardsYesNoButtons &&
        currentTodo && currentTodo.id === 'milestone_phase' &&
        (lowerContent.includes('what awards have you received') ||
        lowerContent.includes('competitions you\'ve won') ||
        (lowerContent.includes('awards') && lowerContent.includes('recognition')))) {
      console.log('🎯 Detected awards question, showing Yes/No buttons');
      setShowAwardsYesNoButtons(true);
      setHasHandledAwards(true);
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

  // Handle phase changes based on todo updates (not phase signals)
  const handlePhaseChange = (fullContent, newPhase) => {
    // Only handle session completion and JSON extraction
    if (fullContent.includes('<SESSION_COMPLETE>GOAL_IDENTIFICATION_FINISHED</SESSION_COMPLETE>')) {
      console.log('✅ Session completed successfully');
      setPhase('completed');
      
      // Auto-generate summary
      setTimeout(() => {
        extractData();
      }, 2000);
    }
    
    // Extract JSON data if present (for final phase)
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
  };

  // Progress indicator functions
  const getPhaseDisplayName = (currentPhase) => {
    // If we have todo information, use that for more accurate status
    if (currentTodo) {
      return currentTodo.content;
    }
    
    // Fallback to phase-based display
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

  // Calculate progress based on actual todo completion
  const getTodoProgress = () => {
    if (!todos || todos.length === 0) return 0;
    
    const completedTodos = todos.filter(todo => todo.status === 'completed').length;
    const inProgressTodos = todos.filter(todo => todo.status === 'in_progress').length;
    
    // Give partial credit for in-progress todos
    const totalProgress = completedTodos + (inProgressTodos * 0.5);
    
    return Math.round((totalProgress / todos.length) * 100);
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

  // Handle Yes/No response for academic stats
  const handleAcademicResponse = async (response) => {
    setIsLoading(true);
    setShowAcademicYesNoButtons(false);
    
    try {
      // Add user response to conversation
      const userMessage = {
        id: `user-${Date.now()}-academic-response`,
        type: 'user',
        content: response === 'yes' ? 'Yes, I\'d like to share my academic stats' : 'No, I\'d prefer to continue without sharing academic stats',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);

      if (response === 'yes') {
        // Show academic stats collection modal
        setShowAcademicModal(true);
        
        // Add counselor response
        const counselorMessage = {
          id: `user-${Date.now()}-academic-prompt`,
          type: 'counselor',
          content: 'Great! Please add your academic achievements one at a time. For each achievement, provide a title and description.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, counselorMessage]);
      } else {
        // Continue with conversation - send the "no" response to unified system
        sendMessage(null, 'No, I\'d prefer to continue without sharing academic stats for now');
      }
      
    } catch (error) {
      console.error('Error handling academic response:', error);
      alert('Failed to process response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit academic stats
  const submitAcademicStats = async () => {
    // Check if at least one field is filled
    const hasData = Object.values(academicForm).some(value => value.trim() !== '');
    
    if (!hasData) {
      alert('Please fill in at least one academic field');
      return;
    }

    setIsLoading(true);
    
    try {
      // Close modal first
      setShowAcademicModal(false);
      
      // Pass the form data directly to finish function
      finishAcademicStatsWithData(academicForm);
      
    } catch (error) {
      console.error('Error submitting academic stats:', error);
      alert('Failed to submit academic stats. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };



  // Finish adding academic stats and continue conversation (with data passed directly)
  const finishAcademicStatsWithData = async (stats) => {
    setIsLoading(true);
    
    try {
      // Store the stats for state management
      setAcademicStats([stats]);
      
      // Create well-formatted summary of academic stats
      const formattedStats = [];
      
      if (stats.currentGPA) formattedStats.push(`**GPA:** ${stats.currentGPA}`);
      if (stats.satScore) formattedStats.push(`**SAT Score:** ${stats.satScore}`);
      if (stats.actScore) formattedStats.push(`**ACT Score:** ${stats.actScore}`);
      if (stats.apCourses) formattedStats.push(`**AP Courses:** ${stats.apCourses}`);
      if (stats.classRank) formattedStats.push(`**Class Rank:** ${stats.classRank}`);
      if (stats.honors) formattedStats.push(`**Honors/Recognition:** ${stats.honors}`);
      if (stats.additionalInfo) formattedStats.push(`**Additional Info:** ${stats.additionalInfo}`);
      
      const formattedContent = formattedStats.join('\n');
      
      // Add nicely formatted summary message to conversation
      const summaryMessage = {
        id: `user-${Date.now()}-academic-summary`,
        type: 'user',
        content: `Here are my academic stats:\n\n${formattedContent}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, summaryMessage]);

      // Send the academic stats info to the unified system
      const academicPrompt = `Here are my academic stats:\n\n${formattedContent}\n\nPlease provide a brief analysis of how these achievements align with my goals.`;
      
      sendMessage(null, academicPrompt);
      
    } catch (error) {
      console.error('Error finishing academic stats:', error);
      alert('Failed to finish academic stats. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Yes/No response for awards
  const handleAwardsResponse = async (response) => {
    setIsLoading(true);
    setShowAwardsYesNoButtons(false);
    
    try {
      // Add user response to conversation
      const userMessage = {
        id: `user-${Date.now()}-awards-response`,
        type: 'user',
        content: response === 'yes' ? 'Yes, I\'d like to share my awards' : 'No, I\'d prefer to continue without sharing awards',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);

      if (response === 'yes') {
        // Show awards collection modal
        setShowAwardsModal(true);
        
        // Add counselor response
        const counselorMessage = {
          id: `user-${Date.now()}-awards-prompt`,
          type: 'counselor',
          content: 'Excellent! Please add your awards and recognitions one at a time. For each award, provide a title and description.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, counselorMessage]);
      } else {
        // Continue with conversation - send the "no" response to unified system
        sendMessage(null, 'No, I\'d prefer to continue without sharing awards for now');
      }
      
    } catch (error) {
      console.error('Error handling awards response:', error);
      alert('Failed to process response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit individual award
  const submitAward = async () => {
    if (!awardsForm.title.trim() || !awardsForm.description.trim()) {
      alert('Please fill in both title and description');
      return;
    }

    setIsLoading(true);
    
    try {
      // Add to local state
      setAwards(prev => [...prev, {
        title: awardsForm.title.trim(),
        description: awardsForm.description.trim(),
        timestamp: new Date().toISOString()
      }]);

      // Store the title before resetting form
      const currentTitle = awardsForm.title;
      
      // Reset form
      setAwardsForm({ title: '', description: '' });
      
      // Close modal and show add more confirmation
      setShowAwardsModal(false);
      setLastAddedAwardsTitle(currentTitle);
      setShowAwardsAddMoreModal(true);
      
    } catch (error) {
      console.error('Error submitting award:', error);
      alert('Failed to submit award. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle add more response for awards
  const handleAwardsAddMoreResponse = (addMore) => {
    setShowAwardsAddMoreModal(false);
    if (addMore) {
      setShowAwardsModal(true);
    } else {
      finishAwards();
    }
  };

  // Finish adding awards and continue conversation
  const finishAwards = async () => {
    setIsLoading(true);
    
    try {
      // Create well-formatted summary of awards
      const formattedAwards = awards.map((award, index) => 
        `${index + 1}. **${award.title}**\n   ${award.description}`
      ).join('\n\n');
      
      // Add nicely formatted summary message to conversation
      const summaryMessage = {
        id: `user-${Date.now()}-awards-summary`,
        type: 'user',
        content: `Here are my awards and recognitions:\n\n${formattedAwards}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, summaryMessage]);

      // Send the awards info to the unified system
      const awardsPrompt = `Here are my awards and recognitions:\n\n${formattedAwards}\n\nPlease provide a brief analysis of how these awards demonstrate my achievements.`;
      
      sendMessage(null, awardsPrompt);
      
    } catch (error) {
      console.error('Error finishing awards:', error);
      alert('Failed to finish awards. Please try again.');
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
      highschool: ''
    });
    setMessages([]);
    setCurrentMessage('');
    setCurrentStep('basic-info');
    setExtracurriculars([]);
    setAcademicStats([]);
    setAwards([]);
    setPhase('');
    setSummaryData(null);
    setTodos([]);
    setCurrentTodo(null);
    setStoredGoals({
      milestone_goals: [],
      intermediate_milestones: [],
      skills: [],
      sectors: []
    });
    setShowYesNoButtons(false);
    setShowECModal(false);
    setShowAddMoreModal(false);
    setHasHandledExtracurriculars(false);
    setShowAcademicYesNoButtons(false);
    setShowAcademicModal(false);
    setHasHandledAcademicStats(false);
    setAcademicForm({ 
      currentGPA: '',
      satScore: '',
      actScore: '',
      apCourses: '',
      classRank: '',
      honors: '',
      additionalInfo: ''
    });
    setShowAwardsYesNoButtons(false);
    setShowAwardsModal(false);
    setShowAwardsAddMoreModal(false);
    setHasHandledAwards(false);
    setOpenDropdown(null);
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

  // Fetch stored goals from database
  const fetchStoredGoals = async () => {
    if (!sessionId) return;
    
    try {
      const response = await fetch(`/api/get-stored-goals/${sessionId}`);
      const data = await response.json();
      
      if (data.success) {
        setStoredGoals(data.goals);
      }
    } catch (error) {
      console.error('Error fetching stored goals:', error);
    }
  };

  // Map goals to Ultra features
  const getUltraFeatures = (categoryName, type) => {
    const features = {
      // College Application Support
      competitive_university_acceptance: [
        { name: 'Chance Me Analysis', description: 'Admission probability analysis for target universities' },
        { name: 'College Roadmap', description: 'Complete application timeline and strategy' },
        { name: 'Admissions Program', description: 'Essay writing and Common App support' }
      ],
      top_20_university_acceptance: [
        { name: 'Chance Me Analysis', description: 'Admission probability analysis for target universities' },
        { name: 'College Roadmap', description: 'Complete application timeline and strategy' },
        { name: 'Admissions Program', description: 'Essay writing and Common App support' }
      ],
      top_10_university_acceptance: [
        { name: 'Chance Me Analysis', description: 'Admission probability analysis for target universities' },
        { name: 'College Roadmap', description: 'Complete application timeline and strategy' },
        { name: 'Admissions Program', description: 'Essay writing and Common App support' }
      ],
      significant_financial_aid: [
        { name: 'Admissions Program', description: 'Essay writing and scholarship applications' },
        { name: 'College Roadmap', description: 'Financial aid timeline and strategy' }
      ],
      full_scholarship: [
        { name: 'Admissions Program', description: 'Scholarship essay optimization' },
        { name: 'College Roadmap', description: 'Merit scholarship strategy' }
      ],
      
      // Skill & Experience Development
      research_project_development: [
        { name: 'Research Plan', description: 'Structured research project pathway' },
        { name: 'Ultra Opportunities', description: 'Research mentorship connections' }
      ],
      research_publication: [
        { name: 'Research Plan', description: 'Publication and presentation strategy' },
        { name: 'Ultra Opportunities', description: 'Academic conference opportunities' }
      ],
      internship_work_experience: [
        { name: 'Internship Opportunities', description: 'Targeted internship matching' },
        { name: 'Ultra Opportunities', description: 'Exclusive industry connections' }
      ],
      standardized_test_achievement: [
        { name: 'SAT Platform', description: 'Personalized test preparation' },
        { name: 'College Roadmap', description: 'Test timeline optimization' }
      ],
      
      // Entrepreneurship & Business
      startup_founding: [
        { name: 'Ultra Opportunities', description: 'Startup incubator connections' },
        { name: 'Internship Opportunities', description: 'Business development experience' }
      ],
      entrepreneurship_business: [
        { name: 'Ultra Opportunities', description: 'Business mentorship programs' },
        { name: 'Internship Opportunities', description: 'Startup internship matching' }
      ],
      business_fundamentals: [
        { name: 'Ultra Opportunities', description: 'Business skill development' },
        { name: 'Internship Opportunities', description: 'Corporate experience programs' }
      ],
      
      // Leadership & Competition
      leadership_position_development: [
        { name: 'Ultra Opportunities', description: 'Leadership development programs' },
        { name: 'Internship Opportunities', description: 'Leadership internship roles' }
      ],
      club_founding: [
        { name: 'Ultra Opportunities', description: 'Club development resources' },
        { name: 'Research Plan', description: 'Impact measurement strategies' }
      ],
      olympiad_success: [
        { name: 'Ultra Opportunities', description: 'Competition coaching programs' },
        { name: 'Research Plan', description: 'Advanced problem-solving training' }
      ],
      
      // Sector-Specific Curriculum Resources
      software_technology: [
        { name: 'CS Curriculum Guide', description: 'Comprehensive computer science learning pathway' },
        { name: 'Internship Opportunities', description: 'Tech internship matching' },
        { name: 'Ultra Opportunities', description: 'Coding bootcamps and mentorship' }
      ],
      artificial_intelligence: [
        { name: 'CS Curriculum Guide', description: 'AI/ML specialized learning track' },
        { name: 'Research Plan', description: 'AI research project development' },
        { name: 'Ultra Opportunities', description: 'AI research lab connections' }
      ],
      data_science: [
        { name: 'CS Curriculum Guide', description: 'Data science and analytics pathway' },
        { name: 'Research Plan', description: 'Data science project methodology' },
        { name: 'Internship Opportunities', description: 'Data science internship matching' }
      ],
      investment_banking_field: [
        { name: 'Finance Curriculum Guide', description: 'Comprehensive finance and banking pathway' },
        { name: 'Internship Opportunities', description: 'Finance internship matching' },
        { name: 'Ultra Opportunities', description: 'Wall Street networking programs' }
      ],
      quantitative_finance: [
        { name: 'Finance Curriculum Guide', description: 'Quantitative finance and modeling track' },
        { name: 'Research Plan', description: 'Financial modeling projects' },
        { name: 'Ultra Opportunities', description: 'Quant trading mentorship' }
      ],
      venture_capital_field: [
        { name: 'Finance Curriculum Guide', description: 'VC and startup finance pathway' },
        { name: 'Ultra Opportunities', description: 'VC firm networking and internships' },
        { name: 'Internship Opportunities', description: 'Startup and VC experience' }
      ],
      medicine_clinical: [
        { name: 'Medicine Curriculum Guide', description: 'Pre-med and clinical pathway' },
        { name: 'Research Plan', description: 'Medical research opportunities' },
        { name: 'Ultra Opportunities', description: 'Hospital shadowing and clinical experience' }
      ],
      medicine_research: [
        { name: 'Medicine Curriculum Guide', description: 'Medical research and biotech track' },
        { name: 'Research Plan', description: 'Biomedical research project development' },
        { name: 'Ultra Opportunities', description: 'Research lab placements' }
      ],
      biomedical_engineering: [
        { name: 'Medicine Curriculum Guide', description: 'Biomedical engineering pathway' },
        { name: 'Research Plan', description: 'Bioengineering project development' },
        { name: 'Ultra Opportunities', description: 'Biotech industry connections' }
      ],
      healthcare_field_entry: [
        { name: 'Medicine Curriculum Guide', description: 'Healthcare career exploration guide' },
        { name: 'Ultra Opportunities', description: 'Healthcare shadowing programs' },
        { name: 'Internship Opportunities', description: 'Healthcare internship matching' }
      ],
      law_corporate: [
        { name: 'Law Curriculum Guide', description: 'Pre-law and corporate law pathway' },
        { name: 'Internship Opportunities', description: 'Law firm internship matching' },
        { name: 'Ultra Opportunities', description: 'Legal networking and mentorship' }
      ],
      government_policy: [
        { name: 'Law Curriculum Guide', description: 'Public policy and government track' },
        { name: 'Ultra Opportunities', description: 'Government internship programs' },
        { name: 'Research Plan', description: 'Policy research projects' }
      ],
      engineering_fields: [
        { name: 'Engineering Curriculum Guide', description: 'Comprehensive engineering pathway' },
        { name: 'Research Plan', description: 'Engineering project development' },
        { name: 'Internship Opportunities', description: 'Engineering internship matching' }
      ],
      consulting: [
        { name: 'Business Curriculum Guide', description: 'Management consulting pathway' },
        { name: 'Ultra Opportunities', description: 'Consulting firm networking' },
        { name: 'Internship Opportunities', description: 'Consulting internship matching' }
      ],
      
      // Skill-Based Curriculum Resources
      programming_languages: [
        { name: 'CS Curriculum Guide', description: 'Programming fundamentals and advanced concepts' },
        { name: 'Ultra Opportunities', description: 'Coding bootcamps and tech mentorship' },
        { name: 'Internship Opportunities', description: 'Software development internships' }
      ],
      ai_machine_learning: [
        { name: 'CS Curriculum Guide', description: 'AI/ML comprehensive learning track' },
        { name: 'Research Plan', description: 'AI research project development' },
        { name: 'Ultra Opportunities', description: 'AI research lab connections' }
      ],
      data_science_analytics: [
        { name: 'CS Curriculum Guide', description: 'Data science and analytics pathway' },
        { name: 'Research Plan', description: 'Data analysis project methodology' },
        { name: 'Internship Opportunities', description: 'Data analyst internship matching' }
      ],
      financial_analysis: [
        { name: 'Finance Curriculum Guide', description: 'Financial analysis and modeling' },
        { name: 'Ultra Opportunities', description: 'Finance industry mentorship' },
        { name: 'Internship Opportunities', description: 'Financial analyst internships' }
      ],
      economics: [
        { name: 'Finance Curriculum Guide', description: 'Economics and market analysis' },
        { name: 'Research Plan', description: 'Economic research projects' },
        { name: 'Ultra Opportunities', description: 'Economic policy internships' }
      ],
      biology_mastery: [
        { name: 'Medicine Curriculum Guide', description: 'Biology and life sciences pathway' },
        { name: 'Research Plan', description: 'Biological research opportunities' },
        { name: 'Ultra Opportunities', description: 'Research lab placements' }
      ],
      scientific_method: [
        { name: 'Research Plan', description: 'Scientific methodology and project design' },
        { name: 'Ultra Opportunities', description: 'Research mentorship programs' },
        { name: 'Medicine Curriculum Guide', description: 'Scientific research fundamentals' }
      ]
    };
    
    // Return mapped features or default exploration
    return features[categoryName] || [
      { name: 'Exploration Path', description: 'Discover your optimal career direction' },
      { name: 'Ultra Opportunities', description: 'Explore high-impact experiences' }
    ];
  };

  // Get top ranked categories for display
  const getTopRankedCategories = () => {
    const allCategories = [];
    
    // Add milestone goals
    if (storedGoals.milestone_goals) {
      storedGoals.milestone_goals.forEach(goal => {
        allCategories.push({
          type: 'Milestone Goal',
          name: formatGoalName(goal.category_name),
          ranking: goal.percentage,
          categoryName: goal.category_name,
          features: getUltraFeatures(goal.category_name, 'milestone')
        });
      });
    }
    
    // Add intermediate milestones
    if (storedGoals.intermediate_milestones) {
      storedGoals.intermediate_milestones.forEach(goal => {
        allCategories.push({
          type: 'Intermediate Goal',
          name: formatGoalName(goal.category_name),
          ranking: goal.percentage,
          categoryName: goal.category_name,
          features: getUltraFeatures(goal.category_name, 'intermediate')
        });
      });
    }
    
    // Add skills
    if (storedGoals.skills) {
      storedGoals.skills.forEach(skill => {
        allCategories.push({
          type: 'Skill',
          name: formatGoalName(skill.category_name),
          ranking: skill.percentage,
          categoryName: skill.category_name,
          features: getUltraFeatures(skill.category_name, 'skill')
        });
      });
    }
    
    // Add sectors
    if (storedGoals.sectors) {
      storedGoals.sectors.forEach(sector => {
        allCategories.push({
          type: 'Sector',
          name: formatGoalName(sector.category_name),
          ranking: sector.percentage,
          categoryName: sector.category_name,
          features: getUltraFeatures(sector.category_name, 'sector')
        });
      });
    }
    
    // Sort by ranking (lower number = higher priority) and return top 6
    return allCategories.sort((a, b) => a.ranking - b.ranking).slice(0, 6);
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
                    style={{ width: `${getTodoProgress()}%` }}
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

            {/* Yes/No buttons for academic stats question */}
            {showAcademicYesNoButtons && (
              <div className="yes-no-container">
                <button 
                  onClick={() => handleAcademicResponse('yes')} 
                  disabled={isLoading}
                  className="yes-button"
                >
                  Yes, I'd like to share
                </button>
                <button 
                  onClick={() => handleAcademicResponse('no')} 
                  disabled={isLoading}
                  className="no-button"
                >
                  No, let's continue
                </button>
              </div>
            )}

            {/* Yes/No buttons for awards question */}
            {showAwardsYesNoButtons && (
              <div className="yes-no-container">
                <button 
                  onClick={() => handleAwardsResponse('yes')} 
                  disabled={isLoading}
                  className="yes-button"
                >
                  Yes, I'd like to share
                </button>
                <button 
                  onClick={() => handleAwardsResponse('no')} 
                  disabled={isLoading}
                  className="no-button"
                >
                  No, let's continue
                </button>
              </div>
            )}
            
            {/* Regular chat input (hidden when showing Yes/No buttons) */}
            {!showYesNoButtons && !showAcademicYesNoButtons && !showAwardsYesNoButtons && (
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
        
        {/* Identified Goals Panel */}
        <div className="features-panel">
          <div className="features-header">
            <h3>Your Identified Goals</h3>
            <div className="features-subtitle">
              {getTopRankedCategories().length === 0 ? 'Goals will appear here as the AI identifies them' : 'Top ranked goals based on our conversation:'}
            </div>
          </div>
          
          <div className="features-content">
            {getTopRankedCategories().length === 0 ? (
              <div className="features-empty">
                <div className="empty-message">Continue the conversation to see your identified goals and priorities appear here.</div>
              </div>
            ) : (
              <div className="features-list">
                {getTopRankedCategories().map((category, index) => (
                  <div key={index} className="feature-item goal-item">
                    <div className="goal-header">
                      <span className="goal-rank">#{category.ranking}</span>
                      <span className="goal-type">{category.type}</span>
                    </div>
                    <div className="goal-main">
                      <h4 className="feature-title">{category.name}</h4>
                      <button 
                        className="dropdown-toggle"
                        onClick={() => setOpenDropdown(openDropdown === index ? null : index)}
                      >
                        {openDropdown === index ? '▲' : '▼'}
                      </button>
                    </div>
                    {openDropdown === index && (
                      <div className="goal-features-dropdown">
                        <div className="dropdown-header">Available Ultra Features:</div>
                        {category.features.map((feature, featureIndex) => (
                          <div key={featureIndex} className="dropdown-feature">
                            <div className="dropdown-feature-name">{feature.name}</div>
                            <div className="dropdown-feature-description">{feature.description}</div>
                          </div>
                        ))}
                      </div>
                    )}
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

        {/* Academic Stats Modal */}
        {showAcademicModal && (
          <div className="modal-overlay" onClick={() => setShowAcademicModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Academic Statistics</h3>
                <button 
                  onClick={() => setShowAcademicModal(false)}
                  className="modal-close"
                >
                  ×
                </button>
              </div>
              
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Current GPA (Optional)</label>
                    <input
                      type="text"
                      value={academicForm.currentGPA}
                      onChange={(e) => setAcademicForm(prev => ({ ...prev, currentGPA: e.target.value }))}
                      placeholder="e.g., 3.8, 4.0 unweighted"
                      disabled={isLoading}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Class Rank (Optional)</label>
                    <input
                      type="text"
                      value={academicForm.classRank}
                      onChange={(e) => setAcademicForm(prev => ({ ...prev, classRank: e.target.value }))}
                      placeholder="e.g., 15/400, Top 10%"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>SAT Score (Optional)</label>
                    <input
                      type="text"
                      value={academicForm.satScore}
                      onChange={(e) => setAcademicForm(prev => ({ ...prev, satScore: e.target.value }))}
                      placeholder="e.g., 1450, 1520"
                      disabled={isLoading}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>ACT Score (Optional)</label>
                    <input
                      type="text"
                      value={academicForm.actScore}
                      onChange={(e) => setAcademicForm(prev => ({ ...prev, actScore: e.target.value }))}
                      placeholder="e.g., 32, 35"
                      disabled={isLoading}
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>AP Courses & Scores (Optional)</label>
                  <input
                    type="text"
                    value={academicForm.apCourses}
                    onChange={(e) => setAcademicForm(prev => ({ ...prev, apCourses: e.target.value }))}
                    placeholder="e.g., AP Calculus BC (5), AP Chemistry (4), AP English (5)"
                    disabled={isLoading}
                  />
                </div>
                
                <div className="form-group">
                  <label>Academic Honors & Recognition (Optional)</label>
                  <input
                    type="text"
                    value={academicForm.honors}
                    onChange={(e) => setAcademicForm(prev => ({ ...prev, honors: e.target.value }))}
                    placeholder="e.g., Honor Roll, National Merit Scholar, Dean's List"
                    disabled={isLoading}
                  />
                </div>
                
                <div className="form-group">
                  <label>Additional Academic Information (Optional)</label>
                  <textarea
                    value={academicForm.additionalInfo}
                    onChange={(e) => setAcademicForm(prev => ({ ...prev, additionalInfo: e.target.value }))}
                    placeholder="Any other academic achievements, coursework, or relevant information..."
                    rows="3"
                    disabled={isLoading}
                  />
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  onClick={submitAcademicStats}
                  disabled={isLoading || !Object.values(academicForm).some(value => value.trim() !== '')}
                  className="primary-button"
                >
                  {isLoading ? <div className="loading-spinner"></div> : 'Submit Academic Stats'}
                </button>
                
                <button 
                  onClick={() => setShowAcademicModal(false)}
                  disabled={isLoading}
                  className="secondary-button"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        


        {/* Awards Modal */}
        {showAwardsModal && (
          <div className="modal-overlay" onClick={() => setShowAwardsModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Add Award or Recognition</h3>
                <button 
                  onClick={() => setShowAwardsModal(false)}
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
                    value={awardsForm.title}
                    onChange={(e) => setAwardsForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Science Fair Winner, Scholarship Recipient, Competition Award"
                    disabled={isLoading}
                  />
                </div>
                
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={awardsForm.description}
                    onChange={(e) => setAwardsForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the award, competition, or recognition you received..."
                    rows="4"
                    disabled={isLoading}
                  />
                </div>
                
                {awards.length > 0 && (
                  <div className="added-activities">
                    <h4>Added Awards ({awards.length})</h4>
                    {awards.map((award, index) => (
                      <div key={index} className="activity-chip">
                        {award.title}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="modal-footer">
                <button 
                  onClick={submitAward}
                  disabled={isLoading || !awardsForm.title.trim() || !awardsForm.description.trim()}
                  className="primary-button"
                >
                  {isLoading ? <div className="loading-spinner"></div> : 'Add Award'}
                </button>
                
                {awards.length > 0 && (
                  <button 
                    onClick={finishAwards}
                    disabled={isLoading}
                    className="secondary-button"
                  >
                    Done Adding Awards
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Awards Add More Confirmation Modal */}
        {showAwardsAddMoreModal && (
          <div className="modal-overlay">
            <div className="modal-content confirmation-modal">
              <div className="modal-header">
                <h3>Award Added!</h3>
              </div>
              
              <div className="modal-body">
                <p>Successfully added "{lastAddedAwardsTitle}"!</p>
                <p>Would you like to add another award or recognition?</p>
              </div>
              
              <div className="modal-footer">
                <button 
                  onClick={() => handleAwardsAddMoreResponse(true)}
                  className="primary-button"
                >
                  Add Another
                </button>
                <button 
                  onClick={() => handleAwardsAddMoreResponse(false)}
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
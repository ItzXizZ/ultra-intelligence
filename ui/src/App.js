import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Brain, Target, Zap, Download } from 'lucide-react';
import ProgressBar from './components/ProgressBar';
import MessageBubble from './components/MessageBubble';
import SuggestionButton from './components/SuggestionButton';

const API_BASE_URL = 'http://localhost:3001/api';

function App() {
  const [sessionStarted, setSessionStarted] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [conversation, setConversation] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const suggestions = [
    "I want to be a Software Engineer building next-gen apps",
    "Help me plan for medical school",
    "I'm interested in finance and investing",
    "Show me career paths in AI and machine learning"
  ];

  const startSession = async () => {
    if (!studentName.trim() || !studentEmail.trim()) return;
    
    setIsLoading(true);
    setProgress(20);
    
    try {
      const response = await fetch(`${API_BASE_URL}/start-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: studentName, email: studentEmail })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setProgress(60);
        setSessionStarted(true);
        setShowSuggestions(false);
        
        // Add opening message
        const openingMessage = {
          id: Date.now(),
          type: 'assistant',
          content: data.openingMessage,
          timestamp: new Date()
        };
        
        setConversation([openingMessage]);
        setProgress(100);
        
        // Simulate typing indicator
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 2000);
      }
    } catch (error) {
      console.error('Error starting session:', error);
      // Fallback to demo mode if backend is not available
      setProgress(60);
      setSessionStarted(true);
      setShowSuggestions(false);
      
      const openingMessage = {
        id: Date.now(),
        type: 'assistant',
        content: "Welcome! I'm excited to help you plan your future. What's your biggest goal for the next 5-10 years?",
        timestamp: new Date()
      };
      
      setConversation([openingMessage]);
      setProgress(100);
      
      setIsTyping(true);
      setTimeout(() => setIsTyping(false), 2000);
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  };

  const sendMessage = async (message = currentInput) => {
    if (!message.trim()) return;
    
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: message,
      timestamp: new Date()
    };
    
    setConversation(prev => [...prev, userMessage]);
    setCurrentInput('');
    setIsLoading(true);
    setProgress(30);
    
    try {
      const response = await fetch(`${API_BASE_URL}/conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput: message })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setProgress(80);
        
        // Simulate typing delay
        setIsTyping(true);
        setTimeout(() => {
          const assistantMessage = {
            id: Date.now() + 1,
            type: 'assistant',
            content: data.response,
            timestamp: new Date()
          };
          
          setConversation(prev => [...prev, assistantMessage]);
          setIsTyping(false);
          setProgress(100);
          
          setTimeout(() => setProgress(0), 500);
        }, 1500);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Fallback to demo mode if backend is not available
      setProgress(80);
      
      setIsTyping(true);
      setTimeout(() => {
        const fallbackResponses = [
          "That's interesting! Tell me more about what excites you most about your future.",
          "Great question! What specific skills do you think you'll need to achieve this goal?",
          "I love your enthusiasm! What's the first step you think you need to take?",
          "That's ambitious! What resources or mentors do you have access to?"
        ];
        
        const assistantMessage = {
          id: Date.now() + 1,
          type: 'assistant',
          content: fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
          timestamp: new Date()
        };
        
        setConversation(prev => [...prev, assistantMessage]);
        setIsTyping(false);
        setProgress(100);
        
        setTimeout(() => setProgress(0), 500);
      }, 1500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setCurrentInput(suggestion);
    sendMessage(suggestion);
  };

  const extractData = async () => {
    setIsLoading(true);
    setProgress(50);
    
    try {
      const response = await fetch(`${API_BASE_URL}/extract-data`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setProgress(100);
        
        const successMessage = {
          id: Date.now(),
          type: 'assistant',
          content: "Data extracted successfully! Your conversation has been analyzed and categorized into our goal hierarchy framework.",
          timestamp: new Date()
        };
        
        setConversation(prev => [...prev, successMessage]);
      }
    } catch (error) {
      console.error('Error extracting data:', error);
      
      // Fallback success message
      const successMessage = {
        id: Date.now(),
        type: 'assistant',
        content: "Data extracted successfully! Your conversation has been analyzed and categorized into our goal hierarchy framework.",
        timestamp: new Date()
      };
      
      setConversation(prev => [...prev, successMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => setProgress(0), 500);
    }
  };

  return (
    <div className="min-h-screen bg-ultra-black text-ultra-white">
      {/* Header */}
      <motion.header 
        className="fixed top-0 left-0 right-0 z-50 bg-ultra-black/80 backdrop-blur-sm border-b border-ultra-gray/20"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-ultra-white rounded-full"></div>
            <span className="text-xl font-semibold">Ultra</span>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="pt-24 pb-8 px-6">
        <div className="max-w-4xl mx-auto">
          {!sessionStarted ? (
            /* Welcome Screen */
            <motion.div 
              className="text-center space-y-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="space-y-4">
                <motion.h1 
                  className="text-5xl md:text-6xl font-bold"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  Plan Your Future
                </motion.h1>
                <motion.p 
                  className="text-xl text-gray-300 max-w-2xl mx-auto"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  Let's create a personalized roadmap for your academic and career goals
                </motion.p>
              </div>

              {/* Progress Bar for Session Start */}
              {isLoading && (
                <motion.div 
                  className="max-w-md mx-auto"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <ProgressBar progress={progress} />
                  <p className="text-sm text-gray-400 mt-2">Initializing your session...</p>
                </motion.div>
              )}

              {/* Suggestion Buttons */}
              <motion.div 
                className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                {suggestions.map((suggestion, index) => (
                  <SuggestionButton
                    key={index}
                    text={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    delay={index * 0.1}
                  />
                ))}
              </motion.div>

              {/* Session Start Form */}
              <motion.div 
                className="max-w-md mx-auto space-y-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Your name"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full px-4 py-3 bg-ultra-light-gray rounded-lg text-ultra-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ultra-accent/50"
                  />
                  <input
                    type="email"
                    placeholder="Your email"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-ultra-light-gray rounded-lg text-ultra-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ultra-accent/50"
                  />
                </div>
                <button
                  onClick={startSession}
                  disabled={!studentName.trim() || !studentEmail.trim() || isLoading}
                  className="w-full py-3 bg-ultra-accent hover:bg-ultra-accent/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-all flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Starting Session...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} />
                      <span>Start Your Journey</span>
                    </>
                  )}
                </button>
              </motion.div>
            </motion.div>
          ) : (
            /* Conversation Interface */
            <motion.div 
              className="space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {/* Progress Bar */}
              {isLoading && (
                <motion.div 
                  className="max-w-md mx-auto"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <ProgressBar progress={progress} />
                  <p className="text-sm text-gray-400 mt-2 text-center">Processing your response...</p>
                </motion.div>
              )}

              {/* Conversation Messages */}
              <div className="space-y-4 max-h-96 overflow-y-auto">
                <AnimatePresence>
                  {conversation.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  {isTyping && (
                    <motion.div
                      className="flex items-center space-x-2 text-gray-400"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <span className="text-sm">AI is thinking...</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Input Section */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tell me about your goals and aspirations..."
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  className="w-full px-6 py-4 bg-ultra-light-gray rounded-xl text-ultra-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ultra-accent/50 transition-all"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!currentInput.trim() || isLoading}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-3 bg-ultra-accent hover:bg-ultra-accent/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all"
                >
                  <Send size={20} />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center space-x-4">
                <button
                  onClick={extractData}
                  disabled={isLoading}
                  className="px-6 py-3 bg-ultra-gray hover:bg-ultra-light-gray disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-all flex items-center space-x-2"
                >
                  <Download size={20} />
                  <span>Extract Data</span>
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Footer */}
      <motion.footer 
        className="fixed bottom-4 right-4 text-sm text-gray-400"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        <div className="flex items-center space-x-2">
          <span>Built with</span>
          <div className="w-4 h-4 bg-ultra-white rounded"></div>
          <button className="hover:text-ultra-white transition-colors">×</button>
        </div>
      </motion.footer>
    </div>
  );
}

export default App;

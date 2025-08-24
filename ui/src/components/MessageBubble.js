import React from 'react';
import { motion } from 'framer-motion';
import { User, Brain } from 'lucide-react';

const MessageBubble = ({ message }) => {
  const isUser = message.type === 'user';
  
  return (
    <motion.div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className={`flex items-start space-x-3 max-w-xs md:max-w-md ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-ultra-accent' : 'bg-ultra-light-gray'
        }`}>
          {isUser ? (
            <User size={16} className="text-white" />
          ) : (
            <Brain size={16} className="text-white" />
          )}
        </div>
        
        {/* Message Content */}
        <div className={`px-4 py-3 rounded-2xl ${
          isUser 
            ? 'bg-ultra-accent text-white' 
            : 'bg-ultra-light-gray text-ultra-white'
        }`}>
          <p className="text-sm leading-relaxed">{message.content}</p>
          <p className={`text-xs mt-2 ${
            isUser ? 'text-blue-100' : 'text-gray-400'
          }`}>
            {message.timestamp.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default MessageBubble;

import React from 'react';
import { motion } from 'framer-motion';

const SuggestionButton = ({ text, onClick, delay = 0 }) => {
  return (
    <motion.button
      onClick={onClick}
      className="px-6 py-4 bg-ultra-light-gray hover:bg-ultra-gray text-ultra-white rounded-xl text-left transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-ultra-accent/20 border border-ultra-gray/30 hover:border-ultra-accent/50"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ 
        scale: 1.02,
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.98 }}
    >
      <p className="text-sm leading-relaxed">{text}</p>
    </motion.button>
  );
};

export default SuggestionButton;

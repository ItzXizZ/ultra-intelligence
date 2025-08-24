import React from 'react';
import { motion } from 'framer-motion';

const ProgressBar = ({ progress, className = '' }) => {
  return (
    <div className={`w-full bg-ultra-gray rounded-full h-2 overflow-hidden ${className}`}>
      <motion.div
        className="h-full bg-gradient-to-r from-ultra-accent to-blue-400 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
};

export default ProgressBar;

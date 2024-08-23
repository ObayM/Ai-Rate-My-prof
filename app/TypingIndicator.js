import { motion } from 'framer-motion';

const TypingIndicator = () => (
  <div className="flex space-x-2 p-3 bg-gray-700 rounded-full w-16">
    {[0, 1, 2].map((dot) => (
      <motion.div
        key={dot}
        className="w-2 h-2 bg-gray-400 rounded-full"
        animate={{
          y: ['0%', '-50%', '0%'],
        }}
        transition={{
          duration: 0.6,
          repeat: Infinity,
          repeatType: 'loop',
          delay: dot * 0.2,
        }}
      />
    ))}
  </div>
);

export default TypingIndicator;
'use client';

import { motion } from 'framer-motion';

interface ExplanationPanelProps {
  text: string;
  isStreaming?: boolean;
}

export function ExplanationPanel({ text, isStreaming }: ExplanationPanelProps) {
  if (!text && isStreaming) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="flex gap-1"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        </motion.div>
        <span>Analyzing your question...</span>
      </div>
    );
  }

  return (
    <div className="text-sm leading-relaxed text-foreground/90">
      <p className={isStreaming ? 'typing-cursor' : ''}>
        {text}
      </p>
    </div>
  );
}

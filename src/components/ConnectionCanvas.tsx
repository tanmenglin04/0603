import React, { forwardRef } from 'react';

interface ConnectionCanvasProps {
  className?: string;
}

export const ConnectionCanvas = forwardRef<HTMLCanvasElement, ConnectionCanvasProps>(
  ({ className }, ref) => {
    return (
      <canvas
        ref={ref}
        className={`absolute inset-0 pointer-events-none z-10 ${className || ''}`}
        style={{ touchAction: 'none' }}
      />
    );
  }
);

ConnectionCanvas.displayName = 'ConnectionCanvas';

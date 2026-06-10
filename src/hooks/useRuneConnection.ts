import { useRef, useCallback, useEffect } from 'react';
import type { Rune } from '../types';
import { useGameStore } from '../store/useGameStore';

interface UseRuneConnectionProps {
  gridRef: React.RefObject<HTMLDivElement>;
  cellSize: number;
  gap: number;
  gridSize?: number;
}

export const useRuneConnection = ({ gridRef, cellSize, gap, gridSize }: UseRuneConnectionProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const { runeGrid, selectedRunes, selectRune, addSelectedRune, clearSelectedRunes, confirmMatch } = useGameStore();

  const getRuneAtPosition = useCallback((clientX: number, clientY: number): Rune | null => {
    if (!gridRef.current) return null;
    
    const rect = gridRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const col = Math.floor(x / (cellSize + gap));
    const row = Math.floor(y / (cellSize + gap));
    
    const effectiveSize = gridSize || runeGrid.length;
    if (row >= 0 && row < effectiveSize && col >= 0 && col < effectiveSize) {
      return runeGrid[row]?.[col] || null;
    }
    return null;
  }, [gridRef, cellSize, gap, runeGrid, gridSize]);

  const drawConnection = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || selectedRunes.length < 1) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (selectedRunes.length < 2) return;
    
    const element = selectedRunes[0].element;
    const colors: Record<string, string> = {
      fire: '#ff4d4d',
      water: '#4da6ff',
      grass: '#4dff88',
      thunder: '#ffcc00',
    };
    const color = colors[element];
    
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    
    const offset = (cellSize + gap) / 2;
    
    selectedRunes.forEach((rune, index) => {
      const x = rune.col * (cellSize + gap) + offset;
      const y = rune.row * (cellSize + gap) + offset;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    selectedRunes.forEach(rune => {
      const x = rune.col * (cellSize + gap) + offset;
      const y = rune.row * (cellSize + gap) + offset;
      
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.fill();
    });
  }, [selectedRunes, cellSize, gap]);

  useEffect(() => {
    drawConnection();
  }, [drawConnection]);

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDragging.current = true;
    
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const rune = getRuneAtPosition(clientX, clientY);
    if (rune) {
      selectRune(rune);
    }
  }, [getRuneAtPosition, selectRune]);

  const handleMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const rune = getRuneAtPosition(clientX, clientY);
    if (rune) {
      addSelectedRune(rune);
    }
  }, [getRuneAtPosition, addSelectedRune]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    
    if (selectedRunes.length >= 3) {
      confirmMatch();
    } else {
      clearSelectedRunes();
    }
  }, [selectedRunes.length, confirmMatch, clearSelectedRunes]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        if (selectedRunes.length >= 3) {
          confirmMatch();
        } else {
          clearSelectedRunes();
        }
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [selectedRunes.length, confirmMatch, clearSelectedRunes]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gridRef.current) return;
    
    const rect = gridRef.current.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }, [gridRef]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  return {
    canvasRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    drawConnection,
  };
};

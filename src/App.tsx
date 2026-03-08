import React, { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Hands, HAND_CONNECTIONS, Results } from '@mediapipe/hands';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { Camera } from '@mediapipe/camera_utils';
import { 
  Palette, 
  Eraser, 
  Trash2, 
  Download, 
  Settings, 
  Hand, 
  MousePointer2, 
  PenTool,
  Github,
  Monitor,
  Cpu
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for tailwind class merging
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Constants ---
const COLORS = [
  { name: 'Red', value: '#FF0000' },
  { name: 'Green', value: '#00FF00' },
  { name: 'Blue', value: '#0000FF' },
  { name: 'Yellow', value: '#FFFF00' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Eraser', value: '#000000', isEraser: true },
];

const BRUSH_SIZES = [5, 10, 15, 20, 30];

export default function App() {
  // --- Refs ---
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const handsRef = useRef<Hands | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  
  // --- State ---
  const [selectedColor, setSelectedColor] = useState('#FF0000');
  const [brushSize, setBrushSize] = useState(10);
  const [isEraser, setIsEraser] = useState(false);
  const [mode, setMode] = useState<'selection' | 'drawing' | 'idle'>('idle');
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  
  // Tracking state
  const prevPosRef = useRef<{ x: number; y: number } | null>(null);
  const pointsBufferRef = useRef<{ x: number; y: number }[]>([]);

  // --- Initialization ---
  useEffect(() => {
    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    handsRef.current = hands;

    if (webcamRef.current?.video) {
      const camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          if (webcamRef.current?.video) {
            await hands.send({ image: webcamRef.current.video });
          }
        },
        width: 1280,
        height: 720,
      });
      camera.start();
      cameraRef.current = camera;
    }

    return () => {
      cameraRef.current?.stop();
      handsRef.current?.close();
    };
  }, []);

  // --- Hand Tracking Logic ---
  const onResults = useCallback((results: Results) => {
    if (!isModelLoaded) setIsModelLoaded(true);
    
    const canvas = canvasRef.current;
    const drawingCanvas = drawingCanvasRef.current;
    if (!canvas || !drawingCanvas) return;

    const ctx = canvas.getContext('2d');
    const dCtx = drawingCanvas.getContext('2d');
    if (!ctx || !dCtx) return;

    // Clear overlay canvas
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw landmarks if detected
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      
      // Draw landmarks on overlay
      // We don't need to mirror coordinates here because the canvas itself is mirrored via CSS
      drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
      drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 1, radius: 3 });

      const indexTip = landmarks[8];
      const indexPip = landmarks[7];
      const middleTip = landmarks[12];
      const middlePip = landmarks[11];

      const isIndexUp = indexTip.y < indexPip.y;
      const isMiddleUp = middleTip.y < middlePip.y;

      // Map coordinates to canvas size (No manual mirroring here, handled by CSS)
      const x = indexTip.x * canvas.width;
      const y = indexTip.y * canvas.height;

      if (isIndexUp && isMiddleUp) {
        setMode('selection');
        prevPosRef.current = null;
        pointsBufferRef.current = [];
        
        // Draw selection cursor
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();
      } else if (isIndexUp && !isMiddleUp) {
        setMode('drawing');
        
        // Smoothing logic: Add current point to buffer
        pointsBufferRef.current.push({ x, y });
        if (pointsBufferRef.current.length > 5) {
          pointsBufferRef.current.shift();
        }

        // Average points in buffer for smoothing
        const avgX = pointsBufferRef.current.reduce((sum, p) => sum + p.x, 0) / pointsBufferRef.current.length;
        const avgY = pointsBufferRef.current.reduce((sum, p) => sum + p.y, 0) / pointsBufferRef.current.length;

        // Draw on drawing canvas
        dCtx.lineCap = 'round';
        dCtx.lineJoin = 'round';
        dCtx.strokeStyle = isEraser ? '#000000' : selectedColor;
        dCtx.lineWidth = brushSize;
        dCtx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';

        if (prevPosRef.current) {
          dCtx.beginPath();
          // Use quadraticCurveTo for smoother lines
          const midX = (prevPosRef.current.x + avgX) / 2;
          const midY = (prevPosRef.current.y + avgY) / 2;
          
          dCtx.moveTo(prevPosRef.current.x, prevPosRef.current.y);
          dCtx.quadraticCurveTo(prevPosRef.current.x, prevPosRef.current.y, midX, midY);
          dCtx.lineTo(avgX, avgY);
          dCtx.stroke();
          dCtx.closePath();
        }
        
        prevPosRef.current = { x: avgX, y: avgY };

        // Draw drawing cursor on overlay
        ctx.beginPath();
        ctx.arc(avgX, avgY, brushSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = isEraser ? 'rgba(255,255,255,0.5)' : selectedColor;
        ctx.fill();
        ctx.closePath();
      } else {
        setMode('idle');
        prevPosRef.current = null;
        pointsBufferRef.current = [];
      }
    } else {
      setMode('idle');
      prevPosRef.current = null;
      pointsBufferRef.current = [];
    }

    ctx.restore();
  }, [isModelLoaded, isEraser, selectedColor, brushSize]);

  // Update the hands callback whenever onResults changes (to avoid stale closures)
  useEffect(() => {
    if (handsRef.current) {
      handsRef.current.onResults(onResults);
    }
  }, [onResults]);

  // --- Actions ---
  const clearCanvas = () => {
    const canvas = drawingCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Re-draw watermark on clear
        drawCanvasWatermark(ctx, canvas.width, canvas.height);
      }
    }
  };

  const drawCanvasWatermark = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.font = 'bold 14px Inter';
    ctx.textAlign = 'right';
    ctx.fillText('AYAN BORGI', width - 20, height - 20);
    ctx.restore();
  };

  // Initial watermark
  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) drawCanvasWatermark(ctx, canvas.width, canvas.height);
    }
  }, []);

  const downloadDrawing = () => {
    const canvas = drawingCanvasRef.current;
    if (canvas) {
      const link = document.createElement('a');
      link.download = 'air-drawing.png';
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-emerald-500/30">
      {/* Header / Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-white/10 bg-black/40 backdrop-blur-xl flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <PenTool className="w-6 h-6 text-black" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Air Hand Drawer</h1>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40 font-mono">
              <span className="flex items-center gap-1">
                <Cpu className="w-3 h-3" /> MediaPipe v0.10
              </span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className={cn(
                "flex items-center gap-1",
                isModelLoaded ? "text-emerald-400" : "text-amber-400"
              )}>
                {isModelLoaded ? 'System Ready' : 'Initializing Engine...'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-white/60">
            <Monitor className="w-3.5 h-3.5" />
            1280x720 @ 30FPS
          </div>
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noreferrer"
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Github className="w-5 h-5" />
          </a>
        </div>
      </header>

      <main className="pt-24 pb-12 px-6 max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
        {/* Main Viewport */}
        <div className="space-y-6">
          <div className="relative aspect-[21/9] rounded-3xl overflow-hidden bg-black border border-white/10 shadow-2xl group">
            {/* Webcam Feed */}
            <Webcam
              ref={webcamRef}
              mirrored
              audio={false}
              screenshotFormat="image/jpeg"
              disablePictureInPicture={true}
              forceScreenshotSourceSize={false}
              imageSmoothing={true}
              onUserMedia={() => {}}
              onUserMediaError={() => {}}
              screenshotQuality={0.92}
              className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale-[0.3]"
              videoConstraints={{ width: 1280, height: 720, facingMode: 'user' }}
            />
            
            {/* Drawing Layer */}
            <canvas
              ref={drawingCanvasRef}
              width={1280}
              height={548}
              className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]"
            />

            {/* Landmark Overlay */}
            <canvas
              ref={canvasRef}
              width={1280}
              height={548}
              className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]"
            />

            {/* Mode Indicator */}
            <div className="absolute top-6 left-6 flex items-center gap-3">
              <div className={cn(
                "px-4 py-2 rounded-full backdrop-blur-md border flex items-center gap-2 transition-all duration-300",
                mode === 'drawing' ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" :
                mode === 'selection' ? "bg-blue-500/20 border-blue-500/50 text-blue-400" :
                "bg-white/5 border-white/10 text-white/40"
              )}>
                {mode === 'drawing' ? <PenTool className="w-4 h-4" /> :
                 mode === 'selection' ? <MousePointer2 className="w-4 h-4" /> :
                 <Hand className="w-4 h-4" />}
                <span className="text-xs font-bold uppercase tracking-wider">
                  {mode === 'drawing' ? 'Drawing' : mode === 'selection' ? 'Selection' : 'Idle'}
                </span>
              </div>
            </div>

            {/* Loading Overlay */}
            {!isModelLoaded && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                <p className="text-sm font-mono text-white/60 animate-pulse">Warming up Neural Networks...</p>
              </div>
            )}
          </div>

          {/* Quick Palette (Floating Style) */}
          <div className="flex flex-wrap items-center justify-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-2 pr-4 border-r border-white/10">
              <Palette className="w-4 h-4 text-white/40" />
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Palette</span>
            </div>
            {COLORS.filter(c => !c.isEraser).map((color) => (
              <button
                key={color.name}
                onClick={() => { setSelectedColor(color.value); setIsEraser(false); }}
                className={cn(
                  "w-10 h-10 rounded-full border-2 transition-all duration-200 hover:scale-110",
                  selectedColor === color.value && !isEraser ? "border-white scale-110 shadow-lg" : "border-transparent opacity-60"
                )}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
            <div className="w-px h-8 bg-white/10 mx-2" />
            <button
              onClick={() => setIsEraser(!isEraser)}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                isEraser ? "bg-white text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
              )}
              title="Eraser"
            >
              <Eraser className="w-5 h-5" />
            </button>
            <button
              onClick={clearCanvas}
              className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-all"
              title="Clear Canvas"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sidebar Controls */}
        <aside className="space-y-6">
          {/* Brush Settings */}
          <section className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-6">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white/80">Brush Settings</h2>
            </div>
            
            <div className="space-y-4">
              <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold block">Thickness</label>
              <div className="flex items-center justify-between gap-2">
                {BRUSH_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => setBrushSize(size)}
                    className={cn(
                      "flex-1 h-10 rounded-lg flex items-center justify-center transition-all",
                      brushSize === size ? "bg-emerald-500 text-black font-bold" : "bg-white/5 text-white/60 hover:bg-white/10"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10">
              <button
                onClick={downloadDrawing}
                className="w-full py-4 rounded-2xl bg-white text-black font-bold flex items-center justify-center gap-2 hover:bg-white/90 transition-all active:scale-95 shadow-xl shadow-white/5"
              >
                <Download className="w-5 h-5" />
                Export Drawing
              </button>
            </div>
          </section>

          {/* Instructions */}
          <section className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
            <h2 className="text-[10px] uppercase tracking-widest text-white/40 font-bold">How to Use</h2>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[10px] text-emerald-400 font-bold shrink-0">1</div>
                <p className="text-xs text-white/60 leading-relaxed">Raise your <span className="text-white font-medium">Index Finger</span> to start drawing.</p>
              </li>
              <li className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[10px] text-blue-400 font-bold shrink-0">2</div>
                <p className="text-xs text-white/60 leading-relaxed">Raise <span className="text-white font-medium">Index & Middle</span> fingers to select colors or move cursor.</p>
              </li>
              <li className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[10px] text-white/60 font-bold shrink-0">3</div>
                <p className="text-xs text-white/60 leading-relaxed">Use the <span className="text-white font-medium">Manual Palette</span> below to switch colors and tools.</p>
              </li>
            </ul>
          </section>

          {/* Python Project Info */}
          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
            <p className="text-[10px] text-emerald-400/80 leading-relaxed">
              Looking for the Python source? Check the <code className="bg-emerald-500/10 px-1 rounded">/AirHandDrawer</code> folder in the project files.
            </p>
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10 text-center relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-6 py-2 bg-[#0A0A0A] border border-white/10 rounded-full">
          <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-500 font-bold">
            Created by AYAN BORGI
          </p>
        </div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/20 font-mono mt-4">
          Engineered with Precision &bull; Computer Vision &bull; 2024
        </p>
      </footer>

      {/* Floating Watermark */}
      <div className="fixed bottom-6 right-6 pointer-events-none z-50 opacity-20 hover:opacity-100 transition-opacity duration-500">
        <p className="text-xs font-mono tracking-[0.2em] text-white uppercase select-none">
          &copy; AYAN BORGI
        </p>
      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  FastForward,
  RotateCcw,
  Clock,
  Zap,
  ArrowRight,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  DealTierId,
  DEAL_TIERS,
  DealOrbProfile,
  getLocalGameProfile,
  recordGameRound,
  getGamePhysicsParams,
} from '../lib/gameProfile';

interface DealOrbGameProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onTierUnlocked: (tier: DealTierId, catchTimeMs?: number) => void;
  onSkipGame: () => void;
}

// Particle effect on catch
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
}

// Visual tap ripple for instant click feedback
interface TapRipple {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

export const DealOrbGame: React.FC<DealOrbGameProps> = (props) => {
  if (!props.isOpen) return null;
  return <DealOrbGameContent {...props} />;
};

const DealOrbGameContent: React.FC<DealOrbGameProps> = ({
  isOpen,
  onClose,
  searchQuery,
  onTierUnlocked,
  onSkipGame,
}) => {
  // Game states: 'playing' | 'caught' | 'timeout' | 'skipped'
  // Auto-starts immediately on open for instant engagement
  const [gameState, setGameState] = useState<'playing' | 'caught' | 'timeout' | 'skipped'>('playing');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(10.0);
  const [canSkip, setCanSkip] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  const [caughtTier, setCaughtTier] = useState<DealTierId>('standard');
  const [catchTimeMs, setCatchTimeMs] = useState<number>(0);
  const [userProfile, setUserProfile] = useState<DealOrbProfile>(() => getLocalGameProfile());

  // Refs for animation & high precision timing
  const arenaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const isCaughtRef = useRef<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Orb physics state (initialized in canvas space)
  const orbPosRef = useRef<{ x: number; y: number; vx: number; vy: number; radius: number }>({
    x: 200,
    y: 180,
    vx: 3,
    vy: 2.5,
    radius: 36,
  });

  // Motion trails and celebration particles
  const trailRef = useRef<Array<{ x: number; y: number; alpha: number }>>([]);
  const particlesRef = useRef<Particle[]>([]);
  const ripplesRef = useRef<TapRipple[]>([]);

  // Sound synthesis using Web Audio API (reusing single context cleanly)
  const playSoundEffect = useCallback(
    (type: 'catch' | 'tick' | 'timeout' | 'start') => {
      if (!soundEnabled || typeof window === 'undefined') return;
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioCtx();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        if (type === 'catch') {
          // Cheerful chime: ascending arpeggio C5 -> E5 -> G5 -> C6
          const freqs = [523.25, 659.25, 783.99, 1046.5];
          freqs.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

            gain.gain.setValueAtTime(0.25, ctx.currentTime + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.35);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + idx * 0.08);
            osc.stop(ctx.currentTime + idx * 0.08 + 0.4);
          });
        } else if (type === 'tick') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, ctx.currentTime);
          gain.gain.setValueAtTime(0.05, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.06);
        } else if (type === 'timeout') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(300, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.3);
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.4);
        }
      } catch {
        // audio context blocked or not permitted
      }
    },
    [soundEnabled]
  );

  // Initialize and spawn particles on successful catch
  const spawnCatchParticles = (x: number, y: number) => {
    const particles: Particle[] = [];
    const colors = ['#FF6E40', '#FF9900', '#FFD700', '#FF3F6C', '#FFFFFF', '#4ADE80'];
    for (let i = 0; i < 48; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 8;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2.5 + Math.random() * 4.5,
        alpha: 1.0,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    particlesRef.current = particles;
  };

  // Synchronize canvas internal width/height to DOM container size
  const syncCanvasDimensions = useCallback(() => {
    const arena = arenaRef.current;
    const canvas = canvasRef.current;
    if (!arena || !canvas) return;

    const rect = arena.getBoundingClientRect();
    const w = Math.floor(rect.width || arena.clientWidth || 360);
    const h = Math.floor(rect.height || arena.clientHeight || 340);

    if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w;
      canvas.height = h;

      // Ensure orb remains comfortably inside bounds
      const orb = orbPosRef.current;
      const margin = orb.radius + 10;
      if (orb.x < margin || orb.x > w - margin) orb.x = Math.max(margin, Math.min(w - margin, w * 0.5));
      if (orb.y < margin || orb.y > h - margin) orb.y = Math.max(margin, Math.min(h - margin, h * 0.5));
    }
  }, []);

  // Start or restart a 10-second gameplay round
  const startGameRound = useCallback(() => {
    isCaughtRef.current = false;
    setGameState('playing');
    setElapsedSeconds(0);
    setRemainingSeconds(10.0);
    setCanSkip(false);
    particlesRef.current = [];
    trailRef.current = [];
    ripplesRef.current = [];

    // Accurately compute physics parameters based on returning player difficulty
    const profile = getLocalGameProfile();
    setUserProfile(profile);
    const { baseSpeed, orbRadius } = getGamePhysicsParams(profile.difficultyModifier, reducedMotion);

    syncCanvasDimensions();

    const canvas = canvasRef.current;
    const arenaWidth = canvas?.width || arenaRef.current?.clientWidth || 360;
    const arenaHeight = canvas?.height || arenaRef.current?.clientHeight || 340;

    orbPosRef.current = {
      x: arenaWidth * 0.5,
      y: arenaHeight * 0.5,
      vx: (Math.random() > 0.5 ? 1 : -1) * (baseSpeed * (0.85 + Math.random() * 0.3)),
      vy: (Math.random() > 0.5 ? 1 : -1) * (baseSpeed * (0.85 + Math.random() * 0.3)),
      radius: orbRadius,
    };

    startTimeRef.current = performance.now();
    playSoundEffect('start');
  }, [reducedMotion, playSoundEffect, syncCanvasDimensions]);

  // Handle successful catch
  const handleCatchOrb = useCallback(() => {
    if (isCaughtRef.current) return;
    isCaughtRef.current = true;

    const catchTime = Math.max(10, Math.round(performance.now() - startTimeRef.current));
    setCatchTimeMs(catchTime);

    // Spawn celebration particles at orb center
    spawnCatchParticles(orbPosRef.current.x, orbPosRef.current.y);

    // Determine and record tier
    const { tier } = recordGameRound(true, catchTime);
    setCaughtTier(tier);
    setGameState('caught');
    playSoundEffect('catch');
  }, [playSoundEffect]);

  // Handle skip game
  const handleSkip = useCallback(() => {
    if (gameState === 'caught') return;
    isCaughtRef.current = true;
    recordGameRound(false, null);
    setGameState('skipped');
    onSkipGame();
  }, [gameState, onSkipGame]);

  // Canvas size observation & window resize listeners
  useEffect(() => {
    syncCanvasDimensions();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && arenaRef.current) {
      ro = new ResizeObserver(() => syncCanvasDimensions());
      ro.observe(arenaRef.current);
    }

    window.addEventListener('resize', syncCanvasDimensions);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', syncCanvasDimensions);
    };
  }, [syncCanvasDimensions]);

  // Auto-start round on mount
  useEffect(() => {
    startGameRound();
  }, [startGameRound]);

  // High-accuracy timer and 60fps render loop
  useEffect(() => {
    if (gameState !== 'playing') {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High accuracy timer interval
    timerIntervalRef.current = window.setInterval(() => {
      const now = performance.now();
      const diffSec = (now - startTimeRef.current) / 1000;
      const remain = Math.max(0, 10.0 - diffSec);

      setElapsedSeconds(diffSec);
      setRemainingSeconds(remain);

      // Reveal skip button after 3.0 seconds
      if (diffSec >= 3.0) {
        setCanSkip(true);
      }

      // Check 10s round expiration
      if (remain <= 0 && !isCaughtRef.current) {
        isCaughtRef.current = true;
        recordGameRound(false, null);
        setGameState('timeout');
        playSoundEffect('timeout');
      }
    }, 50);

    // Animation frame for smooth 60fps orb movement & particles
    let lastFrameTime = performance.now();

    const render = () => {
      const now = performance.now();
      const dt = Math.min(32, now - lastFrameTime) / 16.6; // normalized dt
      lastFrameTime = now;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // 1. Draw glowing background grid effect
      ctx.strokeStyle = 'rgba(255, 110, 64, 0.08)';
      ctx.lineWidth = 1;
      const gridSize = 28;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. Render user click ripples for tactile visual feedback
      if (ripplesRef.current.length > 0) {
        ripplesRef.current.forEach((r) => {
          r.radius += 2.5 * dt;
          r.alpha -= 0.04 * dt;
          if (r.alpha > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 215, 0, ${Math.max(0, r.alpha)})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
          }
        });
        ripplesRef.current = ripplesRef.current.filter((r) => r.alpha > 0);
      }

      const orb = orbPosRef.current;

      // 3. Physics update: bounce off walls
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;

      // Add gentle organic floating curve if not reduced motion
      if (!reducedMotion) {
        orb.vx += Math.sin(now * 0.003) * 0.12 * dt;
        orb.vy += Math.cos(now * 0.003) * 0.12 * dt;
      }

      // Wall collision bounds
      const padding = orb.radius + 4;
      if (orb.x < padding) {
        orb.x = padding;
        orb.vx = Math.abs(orb.vx);
      } else if (orb.x > width - padding) {
        orb.x = width - padding;
        orb.vx = -Math.abs(orb.vx);
      }

      if (orb.y < padding) {
        orb.y = padding;
        orb.vy = Math.abs(orb.vy);
      } else if (orb.y > height - padding) {
        orb.y = height - padding;
        orb.vy = -Math.abs(orb.vy);
      }

      // 4. Motion trails
      if (!reducedMotion) {
        trailRef.current.push({ x: orb.x, y: orb.y, alpha: 0.6 });
        if (trailRef.current.length > 10) {
          trailRef.current.shift();
        }

        trailRef.current.forEach((t, i) => {
          t.alpha -= 0.04;
          if (t.alpha > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(t.x, t.y, orb.radius * (0.55 + i * 0.04), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 140, 0, ${Math.max(0, t.alpha * 0.3)})`;
            ctx.fill();
            ctx.restore();
          }
        });
      }

      // 5. Render main glowing energy orb
      ctx.save();
      // Outer ambient glow aura (pulse effect)
      const pulseScale = 1 + Math.sin(now * 0.008) * 0.1;
      const glowGrad = ctx.createRadialGradient(
        orb.x,
        orb.y,
        orb.radius * 0.2,
        orb.x,
        orb.y,
        orb.radius * 2.3 * pulseScale
      );
      glowGrad.addColorStop(0, 'rgba(255, 170, 0, 0.85)');
      glowGrad.addColorStop(0.35, 'rgba(255, 110, 64, 0.5)');
      glowGrad.addColorStop(1, 'rgba(255, 70, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius * 2.3 * pulseScale, 0, Math.PI * 2);
      ctx.fill();

      // Core shiny orb body
      const coreGrad = ctx.createRadialGradient(
        orb.x - orb.radius * 0.3,
        orb.y - orb.radius * 0.3,
        orb.radius * 0.1,
        orb.x,
        orb.y,
        orb.radius
      );
      coreGrad.addColorStop(0, '#FFFFFF');
      coreGrad.addColorStop(0.25, '#FFE082');
      coreGrad.addColorStop(0.65, '#FF9100');
      coreGrad.addColorStop(1, '#FF3D00');

      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.shadowColor = '#FF6E40';
      ctx.shadowBlur = 24;
      ctx.fill();

      // Internal energy rings
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius * 0.65, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255, 235, 59, 0.7)';
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius * 0.35, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();

      // 6. Update and render particles
      if (particlesRef.current.length > 0) {
        particlesRef.current.forEach((p) => {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.alpha -= 0.022 * dt;

          if (p.alpha > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.fill();
            ctx.restore();
          }
        });
        particlesRef.current = particlesRef.current.filter((p) => p.alpha > 0);
      }

      if (gameState === 'playing') {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [gameState, reducedMotion, playSoundEffect]);

  // Robust, generous click / tap / pointer handler supporting desktop, mobile & iframes
  const handleInteraction = (
    clientX: number,
    clientY: number,
    e?: React.SyntheticEvent | Event
  ) => {
    if (gameState !== 'playing' || isCaughtRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;

    // Convert screen coordinates into canvas coordinate space
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (clientX - rect.left) * scaleX;
    const clickY = (clientY - rect.top) * scaleY;

    // Add tactile ripple ring so user visibly sees where they tapped
    ripplesRef.current.push({
      x: clickX,
      y: clickY,
      radius: 6,
      alpha: 1.0,
    });

    const orb = orbPosRef.current;

    // Distance in canvas space
    const distCanvas = Math.hypot(clickX - orb.x, clickY - orb.y);

    // Distance in screen DOM pixels (failsafe check)
    const orbScreenX = rect.left + (orb.x / canvas.width) * rect.width;
    const orbScreenY = rect.top + (orb.y / canvas.height) * rect.height;
    const distScreen = Math.hypot(clientX - orbScreenX, clientY - orbScreenY);

    // Highly generous and forgiving hit tolerance:
    // Core orb radius (~36px) + outer glowing aura (~36px margin) = ~72px hit bubble.
    // Extremely responsive and rewarding on desktop mice and mobile touchscreens!
    const hitTolerance = Math.max(orb.radius + 36, 70);

    if (distCanvas <= hitTolerance || distScreen <= hitTolerance) {
      if (e && 'stopPropagation' in e) {
        e.stopPropagation();
      }
      handleCatchOrb();
    }
  };

  const activeTierInfo = DEAL_TIERS[caughtTier];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-xl rounded-3xl bg-[#0f1117] text-white border border-neutral-700/80 shadow-2xl overflow-hidden flex flex-col">
        {/* Top Header Bar */}
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/70">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-[#FF6E40] animate-pulse" />
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Catch the Deal Orb</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl text-neutral-400 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 transition-colors cursor-pointer text-xs"
              title={soundEnabled ? 'Mute sound' : 'Enable sound'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Restart button during gameplay */}
            {gameState === 'playing' && (
              <button
                onClick={startGameRound}
                className="p-2 rounded-xl text-neutral-400 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 transition-colors cursor-pointer text-xs"
                title="Restart Round"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            {/* Close / Skip to Deals Button */}
            <button
              onClick={handleSkip}
              className="p-2 rounded-xl text-neutral-400 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Close and show deals"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Query Context Header */}
        <div className="px-5 py-2.5 bg-neutral-900/40 border-b border-neutral-800/80 flex items-center justify-between text-xs">
          <span className="text-neutral-400 truncate max-w-[280px]">
            Searching: <strong className="text-white">"{searchQuery || 'Curated Deals'}"</strong>
          </span>
          <span className="text-[11px] text-amber-400 font-medium">
            {userProfile.gamesPlayed > 0
              ? `Loyal Shopper (Level ${Math.min(5, userProfile.consecutiveVisits)})`
              : 'First Time Hunter'}
          </span>
        </div>

        {/* Main Game Arena / Content */}
        <div className="p-4 sm:p-6 flex-1 flex flex-col items-center justify-center">
          {/* STATE: Active Gameplay Arena */}
          {gameState === 'playing' && (
            <div className="w-full space-y-3">
              {/* Countdown & Progress Meter */}
              <div className="flex items-center justify-between px-1 text-xs">
                <div className="flex items-center gap-2 font-mono">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="text-neutral-300">Time:</span>
                  <strong
                    className={`text-base font-bold ${
                      remainingSeconds < 3.0 ? 'text-red-400 animate-pulse' : 'text-amber-400'
                    }`}
                  >
                    {remainingSeconds.toFixed(1)}s
                  </strong>
                </div>

                {/* Visible Skip button after 3 seconds */}
                {canSkip ? (
                  <button
                    onClick={handleSkip}
                    className="py-1 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 transition-all flex items-center gap-1.5 cursor-pointer animate-fade-in"
                  >
                    <span>Skip Game</span>
                    <FastForward className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                ) : (
                  <span className="text-[10px] text-neutral-500 font-mono">
                    Skip unlocks in {(3.0 - Math.min(3.0, elapsedSeconds)).toFixed(1)}s
                  </span>
                )}
              </div>

              {/* Visual Timer Progress Bar */}
              <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 transition-all duration-75"
                  style={{ width: `${(remainingSeconds / 10.0) * 100}%` }}
                />
              </div>

              {/* Instruction Banner */}
              <div className="text-center py-0.5">
                <p className="text-xs text-neutral-300">
                  <span className="font-bold text-amber-400">⚡ Tap or click the glowing orb!</span> Faster catches unlock higher discount tiers.
                </p>
              </div>

              {/* Interactive Arena Canvas: Captures PointerDown, Touch, and Click */}
              <div
                ref={arenaRef}
                onPointerDown={(e) => handleInteraction(e.clientX, e.clientY, e)}
                onClick={(e) => handleInteraction(e.clientX, e.clientY, e)}
                onTouchStart={(e) => {
                  if (e.touches && e.touches[0]) {
                    handleInteraction(e.touches[0].clientX, e.touches[0].clientY, e);
                  }
                }}
                className="relative w-full h-[300px] sm:h-[340px] rounded-2xl bg-[#090b0e] border border-neutral-800 overflow-hidden shadow-inner flex items-center justify-center cursor-pointer touch-none"
              >
                <canvas
                  ref={canvasRef}
                  className="w-full h-full cursor-crosshair active:scale-100"
                />

                {/* Floating helper pill */}
                <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 pointer-events-none px-3 py-1 rounded-full bg-black/75 backdrop-blur-sm border border-neutral-800 text-[11px] text-amber-300 font-medium">
                  🎯 Click or tap orb to catch
                </div>
              </div>

              {/* Reward Tiers Legend */}
              <div className="grid grid-cols-3 gap-2 text-[10px] sm:text-[11px] text-left pt-1">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <span className="font-bold text-amber-400 block">Tier 1: Apex</span>
                  <span className="text-neutral-400 block">&lt; 3.5s catch</span>
                </div>
                <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/30">
                  <span className="font-bold text-orange-400 block">Tier 2: Gold</span>
                  <span className="text-neutral-400 block">3.5s – 6.5s</span>
                </div>
                <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/30">
                  <span className="font-bold text-sky-400 block">Tier 3: Silver</span>
                  <span className="text-neutral-400 block">6.5s – 10s</span>
                </div>
              </div>
            </div>
          )}

          {/* STATE: Orb Caught Success Celebration */}
          {gameState === 'caught' && (
            <div className="text-center py-5 px-4 space-y-5 max-w-md animate-fade-in">
              <div className="w-20 h-20 mx-auto rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Trophy className="w-10 h-10 text-amber-400 animate-bounce" />
              </div>

              <div>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 mb-2">
                  Orb Caught in {(catchTimeMs / 1000).toFixed(2)}s!
                </span>
                <h3 className="text-2xl font-extrabold text-white">{activeTierInfo.name} Unlocked!</h3>
                <p className="text-xs sm:text-sm text-neutral-300 mt-2 leading-relaxed">
                  {activeTierInfo.description}
                </p>
              </div>

              {/* Action Button: View Unlocked Deals */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    onTierUnlocked(caughtTier, catchTimeMs);
                    onClose();
                  }}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-[#FF6E40] hover:from-amber-400 hover:to-[#e05b30] font-bold text-sm text-white shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                >
                  <span>View Unlocked Deals for "{searchQuery || 'Deals'}"</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STATE: 10s Timer Expired Timeout */}
          {gameState === 'timeout' && (
            <div className="text-center py-6 px-4 space-y-5 max-w-md animate-fade-in">
              <div className="w-16 h-16 mx-auto rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400">
                <Clock className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-white">Time's Up!</h3>
                <p className="text-xs sm:text-sm text-neutral-400 mt-2 leading-relaxed">
                  The 10-second round ended before a catch. Showing standard verified deals for{' '}
                  <strong className="text-white">"{searchQuery || 'All'}"</strong>.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    onTierUnlocked('standard');
                    onClose();
                  }}
                  className="w-full sm:flex-1 py-3 px-5 rounded-2xl bg-[#FF6E40] hover:bg-[#e05b30] text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  View Standard Deals
                </button>

                <button
                  onClick={startGameRound}
                  className="w-full sm:w-auto py-3 px-4 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info & accessibility */}
        <div className="px-5 py-3 bg-neutral-950 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Real verified catalog deals • No fabricated discounts</span>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer text-neutral-400 hover:text-white">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => setReducedMotion(e.target.checked)}
              className="rounded border-neutral-700 text-[#FF6E40] focus:ring-0"
            />
            <span>Reduced Motion</span>
          </label>
        </div>
      </div>
    </div>
  );
};

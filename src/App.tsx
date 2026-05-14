/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Video, 
  Square, 
  GalleryVertical, 
  ShieldCheck, 
  Settings, 
  EyeOff, 
  Eye, 
  Clock, 
  TrendingUp,
  ChevronRight,
  Share2,
  Download,
  Trash2,
  Minimize2,
  RefreshCw
} from 'lucide-react';
import { useCamera } from './hooks/useCamera';

export default function App() {
  const { 
    stream, 
    isRecording, 
    recordings, 
    videoRef, 
    startCamera, 
    stopCamera, 
    startRecording, 
    stopRecording, 
    togglePiP,
    switchCamera,
    setRecordings,
    mediaRecorderRef
  } = useCamera();

  const [activeTab, setActiveTab] = useState<'record' | 'gallery'>('record');
  const [isDisguised, setIsDisguised] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [lang, setLang] = useState<'en' | 'zh'>(() => (localStorage.getItem('cam_pip_lang') as 'en' | 'zh') || 'zh');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [systemHealth, setSystemHealth] = useState<'nominal' | 'warning' | 'error'>('nominal');
  const [isScanning, setIsScanning] = useState(false);
  const [quality, setQuality] = useState<'720p' | '1080p'>(() => (localStorage.getItem('cam_pip_quality') as '720p' | '1080p') || '720p');
  const [frameRate, setFrameRate] = useState<number>(() => Number(localStorage.getItem('cam_pip_fps')) || 30);
  const lastTimeRef = useRef(0);
  const frozenCountRef = useRef(0);
  const keepAliveCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Keep-Alive Mechanism: Force browser to keep rendering the video element
  // by reading from it periodically onto a hidden canvas.
  useEffect(() => {
    let aliveTimer: number;
    const tick = () => {
      if (isInitialized && stream && videoRef.current && keepAliveCanvasRef.current) {
        const video = videoRef.current;
        const canvas = keepAliveCanvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (ctx && video.readyState >= 2) {
          // Drawing just 1x1 pixel is enough to trigger "active" rendering
          ctx.drawImage(video, 0, 0, 1, 1);
        }
      }
    };

    if (isInitialized && stream) {
      aliveTimer = window.setInterval(tick, 200);
    }
    return () => clearInterval(aliveTimer);
  }, [isInitialized, stream]);

  const t = {
    zh: {
      ops: '作战',
      vault: '保险库',
      archives: '档案库',
      stealthOps: '潜行行动',
      pro: '专业版',
      getStarted: '开始使用',
      ready: '准备就绪',
      thermal: '热能指数',
      cpu: 'CPU 负载',
      monitoring: '系统监控中',
      restore: '双击恢复界面',
      privacyActive: '隐私模式已激活',
      cameraOffline: '摄像头离线',
      retry: '重试摄像头',
      noArchives: '未发现存档数据',
      delete: '删除',
      share: '分享',
      download: '下载',
      settings: '设置',
      language: '语言',
      back: '返回',
      flip: '翻转',
      hide: '隐藏',
      show: '显示',
      pip: '画中画',
      fix: '一键修复',
      healthNominal: '系统正常',
      healthWarning: '系统异常',
      accessSecure: '安全访问',
      requirement: '需要摄像头和麦克风权限才能运行。由于这是您的专属特战工具，我们必须确保所有探测器处于活跃状态。',
      encrypted: '本地加密 · 零云端存储',
      permissionDenied: '权限访问受限',
      howToFix: '检测到权限被拒绝。请点击浏览器地址栏旁边的 [锁头] 或 [AA] 图标，将 [摄像头] 和 [麦克风] 重新设置为 [允许]，然后点击下方重试。',
      resolution: '分辨率',
      framerate: '帧率',
      highQuality: '高画质 (1080p)',
      standardQuality: '标准 (720p)',
      fps30: '30 帧 (流畅)',
      fps60: '60 帧 (极致)',
    },
    en: {
      ops: 'Ops',
      vault: 'Vault',
      archives: 'Archives',
      stealthOps: 'Stealth Ops',
      pro: 'Pro',
      getStarted: 'Get Started',
      ready: 'Ready',
      thermal: 'Thermal Index',
      cpu: 'CPU Load',
      monitoring: 'Monitoring Active',
      restore: 'Double-tap to restore',
      privacyActive: 'Privacy Mode Active',
      cameraOffline: 'Camera Offline',
      retry: 'Retry Camera',
      noArchives: 'No archived footage',
      delete: 'Delete',
      share: 'Share',
      download: 'Download',
      settings: 'Settings',
      language: 'Language',
      back: 'Back',
      flip: 'Flip',
      hide: 'Hide',
      show: 'Show',
      pip: 'PiP',
      fix: 'Fix System',
      healthNominal: 'Healthy',
      healthWarning: 'Warning',
      accessSecure: 'Access Secure',
      requirement: 'Camera & Mic access required.',
      encrypted: 'Local Encryption · No Cloud',
      permissionDenied: 'Permission Denied',
      howToFix: 'Tap the [AA] icon in address bar, select [Website Settings], and allow Camera/Mic access.',
      resolution: 'Resolution',
      framerate: 'FPS',
      highQuality: 'High (1080p)',
      standardQuality: 'Standard (720p)',
      fps30: '30 FPS',
      fps60: '60 FPS',
    }
  }[lang];

  // System Health Monitor
  useEffect(() => {
    let healthTimer: number;
    // Improved Frame Freeze Detection & Auto-Recovery
    const checkHealth = async () => {
      // Monitor whenever initialized, even if disguised (important for PiP)
      if (isInitialized && stream && activeTab === 'record') {
        const video = videoRef.current;
        if (!stream.active) {
          setSystemHealth('error');
          // If stream or track is dead, try one-time automatic silent recovery
          if (frozenCountRef.current === 0) {
            handleStart().catch(() => {});
          }
          frozenCountRef.current++;
        } else if (video) {
          const isActuallyPaused = video.paused || video.readyState < 2;
          const isFrozen = !video.paused && video.currentTime === lastTimeRef.current && video.readyState >= 1;
          
          if (isFrozen) {
            frozenCountRef.current++;
          } else {
            frozenCountRef.current = 0;
            lastTimeRef.current = video.currentTime;
          }

          // Recovery levels (more aggressive since interval is now 2s)
          if (isFrozen && frozenCountRef.current === 2) {
            // Level 1: Quick tickle
            console.log('Recovery L1: Tickling video element...');
            video.currentTime = video.currentTime;
            video.play().catch(() => {});
            
            // If recording, request a data chunk to unstick the encoder
            if (isRecording && mediaRecorderRef.current) {
              try { mediaRecorderRef.current.requestData(); } catch (e) {}
            }
          } else if (isFrozen && (frozenCountRef.current === 4 || (isRecording && frozenCountRef.current === 3))) {
            // Level 2: Refresh source object binding
            console.log('Recovery L2: Refreshing source object...');
            const currentStream = video.srcObject;
            video.srcObject = null;
            setTimeout(() => {
              if (currentStream && videoRef.current) {
                videoRef.current.srcObject = currentStream;
                videoRef.current.play().catch(() => {});
              }
            }, 50);
          } else if (isFrozen && (frozenCountRef.current === 6 || (isRecording && frozenCountRef.current === 5))) {
            // Level 3: Hard reset of MediaStream
            console.log('Recovery L3: Hard reset of MediaStream...');
            
            const wasRecording = isRecording;
            if (wasRecording) {
              stopRecording();
            }
            
            await handleStart().catch(() => {});
            
            if (wasRecording) {
              // Give it a moment to stabilize then restart recording
              setTimeout(() => {
                startRecording();
              }, 1000);
            }
            
            frozenCountRef.current = 0;
          }

          if (isActuallyPaused || frozenCountRef.current > 2) {
            setSystemHealth('warning');
          } else {
            setSystemHealth('nominal');
          }
        }
      } else if (isInitialized && !stream) {
        setSystemHealth('error');
      } else {
        setSystemHealth('nominal');
        frozenCountRef.current = 0;
      }
    };
    
    // Force integrity check whenever Ops tab is opened
    if (activeTab === 'record' && isInitialized) {
      setTimeout(checkHealth, 200);
      setTimeout(checkHealth, 1000);
    }
    
    // Resume video on tab focus or visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && videoRef.current && stream && isInitialized) {
        videoRef.current.play().catch(e => console.warn('Focus resume failed:', e));
        // Reset freeze counter on visibility change to avoid false positives
        frozenCountRef.current = 0;
      }
    };

    if (isInitialized) {
      healthTimer = window.setInterval(checkHealth, 2000);
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    
    return () => {
      clearInterval(healthTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isInitialized, stream, isRecording, activeTab, isDisguised, showPreview]);

  // Tab Switch Monitoring
  useEffect(() => {
    if (activeTab === 'record' && isInitialized) {
      setIsScanning(true);
      const timer = setTimeout(() => setIsScanning(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [activeTab, isInitialized]);

  // Language persistence
  useEffect(() => {
    localStorage.setItem('cam_pip_lang', lang);
  }, [lang]);

  // Always show initialization screen on first load per user request
  // Removed automatic handleStart() to ensure guide is seen every time

  // Re-attach stream and sync video element state
  useEffect(() => {
    const video = videoRef.current;
    if (video && stream && isInitialized) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      
      // Attempt to play whenever visibility conditions change
      if (!isDisguised && activeTab === 'record' && showPreview) {
        video.play().catch(e => {
          if (e.name === 'NotAllowedError') {
            console.warn('Autoplay blocked, user interaction required');
            setSystemHealth('warning');
          }
        });
      }
    }
  }, [stream, isDisguised, activeTab, isInitialized, showPreview]);

  useEffect(() => {
    let interval: number;
    if (isRecording) {
      interval = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = async (mode?: 'user' | 'environment') => {
    try {
      setInitError(null);
      if (stream) {
        stopCamera();
      }
      await startCamera(mode, quality, frameRate);
      setIsInitialized(true);
    } catch (err) {
      console.error('Camera initialization failed:', err);
      const isPermissionError = err instanceof Error && (
        err.name === 'NotAllowedError' || 
        err.name === 'PermissionDeniedError' ||
        err.message.includes('denied')
      );
      
      setInitError(isPermissionError ? 'PERMISSION_DENIED' : (err instanceof Error ? err.message : 'Unknown error'));
      setIsInitialized(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('cam_pip_quality', quality);
    localStorage.setItem('cam_pip_fps', frameRate.toString());
  }, [quality, frameRate]);

  const handleFix = async () => {
    setSystemHealth('warning');
    await handleStart();
    if (videoRef.current && stream) {
      try {
        await videoRef.current.play();
      } catch (e) {
        console.warn('Fix play failed:', e);
      }
    }
  };

  const shareVideo = async (video: { url: string, id: string, mimeType: string }) => {
    try {
      const response = await fetch(video.url);
      const blob = await response.blob();
      const extension = video.mimeType.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([blob], `recording-${video.id}.${extension}`, { type: video.mimeType });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Stealth Recording',
          text: 'Shared from CamPiP Stealth',
        });
      } else {
        // Fallback to direct download
        downloadVideo(video);
      }
    } catch (err) {
      console.error('Sharing failed:', err);
      downloadVideo(video);
    }
  };

  const deleteVideo = (id: string) => {
    setRecordings(prev => prev.filter(v => v.id !== id));
  };

  const downloadVideo = (video: { url: string, id: string, mimeType: string }) => {
    const a = document.createElement('a');
    a.href = video.url;
    const extension = video.mimeType.includes('mp4') ? 'mp4' : 'webm';
    a.download = `recording-${video.id}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const facingMode = stream?.getVideoTracks()[0]?.getSettings()?.facingMode || 'user';

  return (
    <div className="h-[100dvh] bg-black flex flex-col font-sans overflow-hidden overscroll-none pb-[env(safe-area-inset-bottom)]">
      {/* 1. Header Section */}
      <AnimatePresence>
        {!isDisguised && isInitialized && (
          <motion.header 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-6 flex justify-between items-center z-20 shrink-0"
          >
            <div>
              <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-widest leading-none mb-1">{t.stealthOps}</h2>
              <h1 className="text-2xl font-bold">CamPiP <span className="text-ios-blue">{t.pro}</span></h1>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900/50 rounded-full border border-white/5">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  systemHealth === 'nominal' ? 'bg-ios-green' : 
                  systemHealth === 'warning' ? 'bg-orange-500' : 'bg-ios-red'
                }`} />
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  {systemHealth === 'nominal' ? t.healthNominal : t.healthWarning}
                </span>
                {systemHealth !== 'nominal' && (
                  <button onClick={handleFix} className="text-[10px] text-ios-blue font-bold ml-2 underline">{t.fix}</button>
                )}
              </div>
              <button 
                onClick={() => setIsDisguised(true)}
                className="p-3 bg-zinc-900 rounded-2xl text-zinc-400 active:scale-95 transition-transform"
              >
                <EyeOff className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-3 bg-zinc-900 rounded-2xl text-zinc-400 active:scale-95 transition-transform"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* 2. Content Area with Persisted Video */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Persistent Video Engine */}
        <div 
          className={`
            transition-all duration-500 ease-ios overflow-hidden select-none shrink-0
            ${!isDisguised && activeTab === 'record' && isInitialized
              ? 'relative mx-4 flex-[1.5] rounded-[3rem] shadow-2xl border border-white/5 bg-zinc-900 z-10' 
              : 'fixed top-0 left-0 w-4 h-4 opacity-[0.01] pointer-events-none z-[-1]'
            }
          `}
        >
          <div className="w-full h-full relative">
            <video 
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />
            
            {/* UI Overlays for Video */}
            {!isDisguised && activeTab === 'record' && isInitialized && (
              <>
                {isScanning && (
                  <div className="absolute inset-0 z-50 pointer-events-none">
                    <div className="absolute inset-0 bg-ios-blue/5 animate-pulse" />
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-ios-blue shadow-[0_0_15px_rgba(0,122,255,0.8)] animate-scan-line" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-3">
                        <RefreshCw className="w-3 h-3 text-ios-blue animate-spin" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-[0.2em]">Authenticating Sensor...</span>
                      </div>
                    </div>
                  </div>
                )}
                {systemHealth === 'warning' && !isScanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] text-white gap-4 z-40">
                    <div className="w-16 h-16 bg-ios-blue rounded-full flex items-center justify-center animate-bounce shadow-2xl">
                      <RefreshCw className="w-8 h-8" />
                    </div>
                    <button 
                      onClick={handleFix}
                      className="px-8 py-3 bg-white text-black rounded-full font-bold text-sm shadow-xl active:scale-95 transition-transform"
                    >
                      {t.fix}
                    </button>
                    <p className="text-[10px] uppercase tracking-widest font-bold opacity-70">
                      {t.healthWarning}
                    </p>
                  </div>
                )}
                {!stream && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-4 bg-zinc-900 z-10">
                    <Camera className="w-12 h-12 opacity-20" />
                    <button onClick={() => handleStart()} className="text-xs font-bold text-ios-blue uppercase tracking-widest underline">{t.retry}</button>
                  </div>
                )}
                {showPreview === false && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-zinc-600 gap-3 z-10">
                    <EyeOff className="w-8 h-8 opacity-20" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold">{t.privacyActive}</span>
                  </div>
                )}
                {isRecording && (
                  <div className="absolute top-6 left-6 flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 z-20">
                    <div className="w-2 h-2 bg-ios-red rounded-full animate-pulse" />
                    <span className="text-xs font-mono font-bold tracking-tighter">{formatTime(recordingTime)}</span>
                  </div>
                )}
                <div className="absolute top-6 right-6 flex gap-2 z-20">
                  <button 
                    onClick={() => switchCamera(quality, frameRate)}
                    disabled={isRecording}
                    className={`p-3 bg-black/50 backdrop-blur-md rounded-2xl border border-white/10 text-white active:scale-90 transition-transform ${isRecording ? 'opacity-30' : ''}`}
                    title={t.flip}
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setShowPreview(!showPreview)}
                    className="p-3 bg-black/50 backdrop-blur-md rounded-2xl border border-white/10 text-white active:scale-90 transition-transform"
                    title={showPreview ? t.hide : t.show}
                  >
                    {showPreview ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={togglePiP}
                    className="p-3 bg-black/50 backdrop-blur-md rounded-2xl border border-white/10 text-white active:scale-90 transition-transform"
                    title={t.pip}
                  >
                    <Minimize2 className="w-5 h-5" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tab-specific Content */}
        <div className="flex-1 relative flex flex-col px-6 overflow-hidden">
          <AnimatePresence mode="wait">
            {isInitialized && !isDisguised && (
              activeTab === 'record' ? (
                <motion.div 
                  key="record"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex-1 flex flex-col mt-auto"
                >
                  <div className="flex-1" />
                  <div className="flex justify-center gap-6 py-10">
                    {isRecording ? (
                      <button 
                        onClick={stopRecording}
                        className="w-20 h-20 bg-white rounded-full flex items-center justify-center border-4 border-ios-red active:scale-90 transition-transform"
                      >
                        <div className="w-8 h-8 bg-ios-red rounded-lg" />
                      </button>
                    ) : (
                      <button 
                        onClick={startRecording}
                        disabled={!stream}
                        className={`w-20 h-20 bg-white rounded-full flex items-center justify-center p-1 active:scale-90 transition-transform disabled:opacity-20 disabled:grayscale`}
                      >
                        <div className="w-16 h-16 bg-white border-2 border-zinc-950 rounded-full flex items-center justify-center">
                          <div className="w-12 h-12 bg-ios-red rounded-full" />
                        </div>
                      </button>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="gallery"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex-1 overflow-y-auto pb-24 pt-6 space-y-4 pr-2"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">{t.archives}</h3>
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{recordings.length} items</span>
                  </div>

                  {recordings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-600 gap-4">
                      <Video className="w-12 h-12 opacity-20" />
                      <p className="text-sm font-medium">{t.noArchives}</p>
                    </div>
                  ) : (
                    recordings.map((video) => (
                      <div key={video.id} className="bg-zinc-900 rounded-3xl p-4 flex gap-4 group">
                        <div className="w-24 h-24 bg-black rounded-2xl overflow-hidden flex-shrink-0 border border-white/5">
                          <video src={video.url} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 flex flex-col justify-center gap-1">
                          <div className="text-xs font-bold text-zinc-500">
                            {new Date(video.timestamp).toLocaleDateString()} · {formatTime(Math.floor(video.duration / 1000))}
                          </div>
                          <div className="text-sm font-semibold truncate uppercase tracking-widest">REC_{video.id}</div>
                          <div className="flex gap-3 mt-2">
                            <button 
                              onClick={() => shareVideo(video)}
                              className="p-2 bg-zinc-800 rounded-xl text-ios-blue active:bg-zinc-700"
                              title={t.share}
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => downloadVideo(video)}
                              className="p-2 bg-zinc-800 rounded-xl text-zinc-400 active:bg-zinc-700"
                              title={t.download}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => deleteVideo(video.id)}
                              className="p-2 bg-zinc-800 rounded-xl text-ios-red active:bg-zinc-700"
                              title={t.delete}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 3. Navigation Bar */}
      <AnimatePresence>
        {!isDisguised && isInitialized && (
          <motion.nav 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="ios-blur border-t border-white/5 px-8 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] flex justify-around items-center shrink-0 z-20"
          >
            <button 
              onClick={() => setActiveTab('record')}
              className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'record' ? 'text-ios-blue' : 'text-zinc-500'}`}
            >
              <Camera className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-tighter">{t.ops}</span>
            </button>
            <button 
              onClick={() => setActiveTab('gallery')}
              className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'gallery' ? 'text-ios-blue' : 'text-zinc-500'}`}
            >
              <GalleryVertical className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-tighter">{t.vault}</span>
            </button>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[200] bg-black p-8 pt-[calc(env(safe-area-inset-top)+2rem)] pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-3xl font-bold">{t.settings}</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-ios-blue font-bold">{t.back}</button>
            </div>

            <div className="space-y-6 overflow-y-auto pb-20">
              {/* Quality Settings */}
              <div className="bg-zinc-900 rounded-3xl p-6">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4 block">
                  {t.resolution}
                </label>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setQuality('720p')}
                    className={`flex-1 py-3 rounded-2xl font-bold transition-all ${quality === '720p' ? 'bg-ios-blue text-white shadow-lg' : 'bg-zinc-800 text-zinc-400 opacity-50'}`}
                  >
                    720p
                  </button>
                  <button 
                    onClick={() => setQuality('1080p')}
                    className={`flex-1 py-3 rounded-2xl font-bold transition-all ${quality === '1080p' ? 'bg-ios-blue text-white shadow-lg' : 'bg-zinc-800 text-zinc-400 opacity-50'}`}
                  >
                    1080p
                  </button>
                </div>
                <p className="mt-3 text-[10px] text-zinc-600 font-medium">
                  {quality === '1080p' ? t.highQuality : t.standardQuality}
                </p>
              </div>

              {/* FPS Settings */}
              <div className="bg-zinc-900 rounded-3xl p-6">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4 block">
                  {t.framerate}
                </label>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setFrameRate(30)}
                    className={`flex-1 py-3 rounded-2xl font-bold transition-all ${frameRate === 30 ? 'bg-ios-blue text-white shadow-lg' : 'bg-zinc-800 text-zinc-400 opacity-50'}`}
                  >
                    30 FPS
                  </button>
                  <button 
                    onClick={() => setFrameRate(60)}
                    className={`flex-1 py-3 rounded-2xl font-bold transition-all ${frameRate === 60 ? 'bg-ios-blue text-white shadow-lg' : 'bg-zinc-800 text-zinc-400 opacity-50'}`}
                  >
                    60 FPS
                  </button>
                </div>
                <p className="mt-3 text-[10px] text-zinc-600 font-medium">
                  {frameRate === 60 ? t.fps60 : t.fps30}
                </p>
              </div>

              <div className="bg-zinc-900 rounded-3xl p-6">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4 block">
                  {t.language}
                </label>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setLang('zh')}
                    className={`flex-1 py-3 rounded-2xl font-bold transition-colors ${lang === 'zh' ? 'bg-ios-blue text-white' : 'bg-zinc-800 text-zinc-400'}`}
                  >
                    中文
                  </button>
                  <button 
                    onClick={() => setLang('en')}
                    className={`flex-1 py-3 rounded-2xl font-bold transition-colors ${lang === 'en' ? 'bg-ios-blue text-white' : 'bg-zinc-800 text-zinc-400'}`}
                  >
                    English
                  </button>
                </div>
              </div>

              <button 
                onClick={handleFix}
                className="w-full py-4 bg-ios-blue text-white rounded-[2rem] font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                {t.fix}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disguise Overlay */}
      <AnimatePresence>
        {isDisguised && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black flex flex-col items-center justify-center p-8 select-none z-[100]"
            onDoubleClick={() => setIsDisguised(false)}
          >
            <div className="flex flex-col items-center gap-4 text-zinc-400">
              <Clock className="w-16 h-16 mb-4 animate-pulse" />
              <h1 className="text-6xl font-bold font-mono tracking-widest text-white">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </h1>
              <p className="text-sm uppercase tracking-widest opacity-50">{t.monitoring}</p>
              
              <div className="mt-20 w-full max-w-xs space-y-6">
                <div className="flex justify-between items-end border-b border-zinc-800 pb-2">
                  <span className="text-xs uppercase font-bold text-zinc-600">{t.cpu}</span>
                  <span className="text-lg font-mono text-ios-green">14.2%</span>
                </div>
                <div className="flex justify-between items-end border-b border-zinc-800 pb-2">
                  <span className="text-xs uppercase font-bold text-zinc-600">{t.thermal}</span>
                  <span className="text-lg font-mono text-ios-blue">32°C</span>
                </div>
              </div>
            </div>

            <div className="fixed bottom-12 text-zinc-800 text-[10px] uppercase tracking-widest">
              {t.restore}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Initialization Overlay */}
      <AnimatePresence>
        {!isInitialized && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center p-8 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center overscroll-none"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-sm w-full flex flex-col items-center gap-10"
            >
              <div className="relative group">
                <div className={`w-28 h-28 ${initError ? 'bg-ios-red' : 'bg-ios-blue'} rounded-[2.8rem] flex items-center justify-center shadow-2xl transition-colors duration-500`}>
                  <Camera className="w-14 h-14 text-white" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center border-4 border-black">
                  <ShieldCheck className="w-6 h-6 text-ios-green" />
                </div>
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tighter">{t.accessSecure}</h1>
                <p className="text-zinc-500 text-base leading-relaxed px-6">
                  {initError ? (
                    <span className="text-ios-red font-medium block mb-2">{t.permissionDenied}</span>
                  ) : t.requirement}
                </p>
              </div>

              {initError && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-zinc-900/80 backdrop-blur-xl border border-white/5 p-6 rounded-3xl text-left space-y-3"
                >
                  <div className="flex items-center gap-2 text-ios-blue">
                    <Settings className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Guide</span>
                  </div>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    {t.howToFix}
                  </p>
                </motion.div>
              )}

              <div className="w-full space-y-6">
                <button 
                  onClick={handleStart}
                  className="w-full py-5 bg-white text-black rounded-[2rem] font-black text-xl active:scale-95 transition-all shadow-xl shadow-white/5"
                >
                  {initError ? t.retry : t.getStarted}
                </button>
                <button 
                  onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
                  className="px-6 py-2 bg-zinc-900 rounded-full text-zinc-500 text-[10px] uppercase font-bold tracking-[0.2em] border border-white/5"
                >
                  Language: {lang === 'en' ? 'English' : '简体中文'}
                </button>
              </div>

              <div className="flex flex-col items-center gap-2 opacity-30">
                <p className="text-white text-[10px] uppercase tracking-[0.3em]">
                  {t.encrypted}
                </p>
                <div className="w-1 h-1 bg-white rounded-full animate-ping" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden keep-alive canvas */}
      <div className="fixed -left-10 -top-10 w-1 h-1 overflow-hidden opacity-0 pointer-events-none z-[-100]">
        <canvas ref={keepAliveCanvasRef} width={1} height={1} />
      </div>
    </div>
  );
}


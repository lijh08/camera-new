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
    recorderState,
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
  const [disguiseMode, setDisguiseMode] = useState<'clock' | 'black'>(() => (localStorage.getItem('cam_pip_disguise') as 'clock' | 'black') || 'clock');
  const [quality, setQuality] = useState<'720p' | '1080p'>(() => (localStorage.getItem('cam_pip_quality') as '720p' | '1080p') || '720p');
  const [frameRate, setFrameRate] = useState<number>(() => Number(localStorage.getItem('cam_pip_fps')) || 30);
  const lastTimeRef = useRef(0);
  const frozenCountRef = useRef(0);
  const keepAliveCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let aliveTimer: number;
    const tick = () => {
      if (isInitialized && stream && videoRef.current && keepAliveCanvasRef.current) {
        const video = videoRef.current;
        const canvas = keepAliveCanvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (ctx && video.readyState >= 2) {
          ctx.drawImage(video, 0, 0, 1, 1);
        }
      }
    };

    if (isInitialized && stream) {
      aliveTimer = window.setInterval(tick, 200);
    }
    return () => clearInterval(aliveTimer);
  }, [isInitialized, stream]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.pause();
        }
      } else {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
          mediaRecorderRef.current.resume();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [mediaRecorderRef]);

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
      fullscreen: '全屏模式',
      addHome: '添加到主屏幕以获得全屏体验',
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
      disguise: '伪装模式',
      disguiseClock: '时钟',
      disguiseBlack: '全黑',
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
      fullscreen: 'Fullscreen',
      addHome: 'Add to Home Screen for App mode',
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
      disguise: 'Disguise Mode',
      disguiseClock: 'Clock',
      disguiseBlack: 'Blackout',
    }
  }[lang];

  useEffect(() => {
    let healthTimer: number;
    const checkHealth = async () => {
      if (isInitialized && stream && activeTab === 'record') {
        const video = videoRef.current;
        if (!stream.active) {
          setSystemHealth('error');
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

          if (isFrozen && (frozenCountRef.current === 2 || document.pictureInPictureElement)) {
            video.currentTime = video.currentTime;
            video.play().catch(() => {});
            if (isRecording && mediaRecorderRef.current) {
              try { mediaRecorderRef.current.requestData(); } catch (e) {}
            }
          } 
          
          if (isFrozen && (frozenCountRef.current === 4 || (isRecording && frozenCountRef.current === 3))) {
            const currentStream = video.srcObject;
            video.srcObject = null;
            setTimeout(() => {
              if (currentStream && videoRef.current) {
                videoRef.current.srcObject = currentStream;
                videoRef.current.play().catch(() => {});
              }
            }, 50);
          } else if (isFrozen && (frozenCountRef.current === 6 || (isRecording && frozenCountRef.current === 5))) {
            const wasRecording = isRecording;
            if (wasRecording) stopRecording();
            await handleStart().catch(() => {});
            if (wasRecording) {
              setTimeout(() => startRecording(quality), 1000);
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
    
    if (isInitialized) {
      healthTimer = window.setInterval(checkHealth, 2000);
    }
    
    return () => clearInterval(healthTimer);
  }, [isInitialized, stream, isRecording, activeTab, quality]);

  useEffect(() => {
    localStorage.setItem('cam_pip_quality', quality);
    localStorage.setItem('cam_pip_fps', frameRate.toString());
    localStorage.setItem('cam_pip_disguise', disguiseMode);
  }, [quality, frameRate, disguiseMode]);

  const handleStart = async (mode?: 'user' | 'environment') => {
    try {
      setInitError(null);
      if (stream) stopCamera();
      await startCamera(mode, quality, frameRate);
      setIsInitialized(true);
    } catch (err) {
      const isPermissionError = err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
      setInitError(isPermissionError ? 'PERMISSION_DENIED' : 'Error');
      setIsInitialized(false);
    }
  };

  const shareVideo = async (video: { url: string, id: string, mimeType: string }) => {
    try {
      const response = await fetch(video.url);
      const blob = await response.blob();
      const extension = video.mimeType.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([blob], `recording-${video.id}.${extension}`, { type: video.mimeType });
      if (navigator.share) await navigator.share({ files: [file] });
      else downloadVideo(video);
    } catch (err) {
      downloadVideo(video);
    }
  };

  const downloadVideo = (video: { url: string, id: string, mimeType: string }) => {
    const a = document.createElement('a');
    a.href = video.url;
    const extension = video.mimeType.includes('mp4') ? 'mp4' : 'webm';
    a.download = `recording-${video.id}.${extension}`;
    a.click();
  };

  const deleteVideo = (id: string) => setRecordings(prev => prev.filter(v => v.id !== id));
  const facingMode = stream?.getVideoTracks()[0]?.getSettings()?.facingMode || 'user';
  const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  useEffect(() => {
    let interval: number;
    if (isRecording) {
      interval = window.setInterval(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          setRecordingTime(prev => prev + 1);
        }
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording, mediaRecorderRef]);

  const handleFix = async () => {
    await handleStart();
    if (videoRef.current) videoRef.current.play().catch(() => {});
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  return (
    <div className="h-[100dvh] bg-black flex flex-col font-sans overflow-hidden overscroll-none pb-[env(safe-area-inset-bottom)]">
      <AnimatePresence>
        {!isDisguised && isInitialized && (
          <motion.header className="px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-6 flex justify-between items-center z-20 shrink-0">
            <div>
              <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-widest leading-none mb-1">{t.stealthOps}</h2>
              <h1 className="text-2xl font-bold">CamPiP <span className="text-ios-blue">{t.pro}</span></h1>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setIsDisguised(true)} className="p-3 bg-zinc-900 rounded-2xl text-zinc-400"><EyeOff className="w-5 h-5" /></button>
              <button onClick={() => setIsSettingsOpen(true)} className="p-3 bg-zinc-900 rounded-2xl text-zinc-400"><Settings className="w-5 h-5" /></button>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col overflow-y-auto px-4 gap-6 scrollbar-hide overscroll-contain">
        <div className={`transition-all duration-500 shrink-0 ${!isDisguised && activeTab === 'record' && isInitialized ? 'relative w-full rounded-[3rem] shadow-2xl bg-zinc-900 overflow-hidden min-h-[200px]' : 'fixed w-8 h-8 opacity-0 pointer-events-none'}`}>
          <video ref={videoRef} autoPlay muted playsInline className={`w-full h-auto max-h-[60vh] object-contain ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
          {isRecording && !isDisguised && (
            <div className="absolute top-6 left-6 flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full">
              <div className={`w-2 h-2 rounded-full ${recorderState === 'paused' ? 'bg-yellow-500' : 'bg-ios-red animate-pulse'}`} />
              <span className="text-xs font-mono">
                {recorderState === 'paused' ? 'PAUSED' : formatTime(recordingTime)}
              </span>
            </div>
          )}
          {!isDisguised && activeTab === 'record' && (
            <div className="absolute top-6 right-6 flex gap-2">
              <button onClick={() => switchCamera(quality, frameRate)} className="p-3 bg-black/50 rounded-2xl text-white"><RefreshCw className="w-5 h-5" /></button>
              <button onClick={togglePiP} className="p-3 bg-black/50 rounded-2xl text-white"><Minimize2 className="w-5 h-5" /></button>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col pb-10">
          <AnimatePresence mode="wait">
            {!isDisguised && isInitialized && (
              activeTab === 'record' ? (
                <motion.div className="flex-1 flex flex-col items-center justify-center py-8 min-h-[300px]">
                  <div className="relative group">
                    <button 
                      onClick={() => isRecording ? stopRecording() : startRecording(quality)} 
                      className={`w-32 h-32 bg-white/10 rounded-full flex items-center justify-center p-2 active:scale-90 transition-transform`}
                    >
                      <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center p-1">
                        <div className="w-24 h-24 border-8 border-black/5 rounded-full flex items-center justify-center">
                          <div className={`transition-all duration-500 ${isRecording ? 'w-12 h-12 rounded-2xl' : 'w-20 h-20 rounded-full'} bg-ios-red shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]`} />
                        </div>
                      </div>
                    </button>
                    {isRecording && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-2 -right-2 w-8 h-8 bg-ios-red rounded-full flex items-center justify-center text-white font-bold text-xs border-4 border-black"
                      >
                        REC
                      </motion.div>
                    )}
                  </div>
                  <div className="mt-8 flex flex-col items-center gap-2">
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em]">{isRecording ? 'Operational Trace Active' : t.ready}</p>
                    <div className="flex gap-1">
                      {[1, 2, 3].map(i => (
                        <div key={i} className={`w-1 h-1 rounded-full bg-ios-blue ${isRecording ? 'animate-bounce' : 'opacity-20'}`} style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="flex-1 space-y-4">
                  {recordings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-700">
                      <GalleryVertical className="w-12 h-12 mb-4 opacity-20" />
                      <p className="text-xs uppercase font-bold tracking-widest">{t.noArchives}</p>
                    </div>
                  ) : recordings.map(v => (
                    <div key={v.id} className="bg-zinc-900 rounded-[2.5rem] p-5 flex gap-5 border border-white/5">
                      <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-black shrink-0">
                        <video src={v.url} className="w-full h-full object-cover" />
                        <div className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded text-[8px] font-mono text-white">
                          {formatTime(Math.floor(v.duration / 1000))}
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col justify-center gap-2">
                        <div>
                          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{new Date(v.timestamp).toLocaleDateString()}</div>
                          <div className="text-sm font-bold text-zinc-200">OPS_DATA_{v.id}</div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => shareVideo(v)} className="flex-1 py-2 bg-ios-blue/10 text-ios-blue rounded-xl flex items-center justify-center"><Share2 className="w-4 h-4" /></button>
                          <button onClick={() => downloadVideo(v)} className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-xl flex items-center justify-center"><Download className="w-4 h-4" /></button>
                          <button onClick={() => deleteVideo(v.id)} className="flex-1 py-2 bg-ios-red/10 text-ios-red rounded-xl flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </AnimatePresence>
        </div>
      </div>

      {!isDisguised && isInitialized && (
        <nav className="border-t border-white/5 px-8 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] flex justify-around">
          <button onClick={() => setActiveTab('record')} className={activeTab === 'record' ? 'text-ios-blue' : 'text-zinc-500'}><Camera className="w-6 h-6" /></button>
          <button onClick={() => setActiveTab('gallery')} className={activeTab === 'gallery' ? 'text-ios-blue' : 'text-zinc-500'}><GalleryVertical className="w-6 h-6" /></button>
        </nav>
      )}

      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black p-8 pt-[env(safe-area-inset-top)] flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold">{t.settings}</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-ios-blue font-bold">{t.back}</button>
            </div>
            <div className="space-y-6 overflow-y-auto">
              <div className="bg-zinc-900 rounded-3xl p-5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 block">{t.fullscreen}</label>
                <div className="space-y-4">
                  <button onClick={toggleFullscreen} className="w-full py-4 bg-ios-blue text-white rounded-2xl font-bold flex items-center justify-center gap-2">
                    <Minimize2 className="w-5 h-5 rotate-45" />
                    {t.fullscreen}
                  </button>
                  <p className="text-[10px] text-zinc-600 text-center uppercase tracking-widest">{t.addHome}</p>
                </div>
              </div>
              <div className="bg-zinc-900 rounded-3xl p-5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 block">{t.disguise}</label>
                <div className="flex gap-2">
                  <button onClick={() => setDisguiseMode('clock')} className={`flex-1 py-3 rounded-2xl font-bold transition-all ${disguiseMode === 'clock' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-500'}`}>{t.disguiseClock}</button>
                  <button onClick={() => setDisguiseMode('black')} className={`flex-1 py-3 rounded-2xl font-bold transition-all ${disguiseMode === 'black' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-500'}`}>{t.disguiseBlack}</button>
                </div>
              </div>
              <div className="bg-zinc-900 rounded-3xl p-5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 block">{t.resolution}</label>
                <div className="flex gap-2">
                  <button onClick={() => setQuality('720p')} className={`flex-1 py-3 rounded-2xl font-bold ${quality === '720p' ? 'bg-ios-blue text-white' : 'bg-zinc-800 text-zinc-500'}`}>720p</button>
                  <button onClick={() => setQuality('1080p')} className={`flex-1 py-3 rounded-2xl font-bold ${quality === '1080p' ? 'bg-ios-blue text-white' : 'bg-zinc-800 text-zinc-500'}`}>1080p</button>
                </div>
              </div>
              <div className="bg-zinc-900 rounded-3xl p-5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 block">{t.framerate}</label>
                <div className="flex gap-2">
                  <button onClick={() => setFrameRate(30)} className={`flex-1 py-3 rounded-2xl font-bold ${frameRate === 30 ? 'bg-ios-blue text-white' : 'bg-zinc-800 text-zinc-500'}`}>30 FPS</button>
                  <button onClick={() => setFrameRate(60)} className={`flex-1 py-3 rounded-2xl font-bold ${frameRate === 60 ? 'bg-ios-blue text-white' : 'bg-zinc-800 text-zinc-500'}`}>60 FPS</button>
                </div>
              </div>
              <div className="bg-zinc-900 rounded-3xl p-5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 block">{t.language}</label>
                <div className="flex gap-2">
                  <button onClick={() => setLang('zh')} className={`flex-1 py-3 rounded-2xl font-bold ${lang === 'zh' ? 'bg-ios-blue text-white' : 'bg-zinc-800 text-zinc-500'}`}>中文</button>
                  <button onClick={() => setLang('en')} className={`flex-1 py-3 rounded-2xl font-bold ${lang === 'en' ? 'bg-ios-blue text-white' : 'bg-zinc-800 text-zinc-500'}`}>English</button>
                </div>
              </div>
              <button onClick={handleFix} className="w-full py-4 bg-zinc-800 text-white rounded-3xl font-bold flex items-center justify-center gap-2"><RefreshCw className="w-5 h-5" />{t.fix}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDisguised && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black z-[500] flex flex-col items-center justify-center" onDoubleClick={() => setIsDisguised(false)}>
            {disguiseMode === 'clock' ? (
              <div className="flex flex-col items-center text-zinc-400 gap-4">
                <Clock className="w-12 h-12 opacity-20 animate-pulse" />
                <div className="text-6xl font-mono font-bold text-white tracking-widest">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div className="text-[10px] uppercase tracking-widest opacity-30">{t.monitoring}</div>
              </div>
            ) : <div className="w-1 h-1 bg-zinc-900 rounded-full opacity-5 animate-pulse" />}
            <div className="fixed bottom-12 text-[10px] text-zinc-900/40 uppercase tracking-widest">{t.restore}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isInitialized && (
          <motion.div 
            initial={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[600] bg-black flex flex-col items-center justify-center p-10 text-center overflow-y-auto"
          >
            <div className="w-24 h-24 bg-ios-blue rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl shrink-0">
              <Camera className="w-12 h-12 text-white" />
            </div>
            
            <h1 className="text-3xl font-bold mb-4">{initError === 'PERMISSION_DENIED' ? t.permissionDenied : t.accessSecure}</h1>
            
            <div className="bg-zinc-900/50 p-6 rounded-3xl mb-8 border border-white/5">
              <p className="text-zinc-400 text-sm leading-relaxed">
                {initError === 'PERMISSION_DENIED' ? t.howToFix : t.requirement}
              </p>
            </div>

            <button 
              onClick={() => handleStart()} 
              className="w-full py-5 bg-white text-black rounded-[2rem] font-bold text-lg active:scale-95 transition-transform flex items-center justify-center gap-2 mb-4"
            >
              {initError === 'PERMISSION_DENIED' && <RefreshCw className="w-5 h-5" />}
              {initError === 'PERMISSION_DENIED' ? t.retry : t.getStarted}
            </button>
            
            <button 
              onClick={() => setLang(lang === 'en' ? 'zh' : 'en')} 
              className="text-[10px] text-zinc-600 uppercase font-bold tracking-[0.3em]"
            >
              Language: {lang === 'en' ? 'English' : '中文'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed opacity-0 pointer-events-none z-[-100]"><canvas ref={keepAliveCanvasRef} width={1} height={1} /></div>
    </div>
  );
}

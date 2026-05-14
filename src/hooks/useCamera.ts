import { useState, useRef, useCallback, useEffect } from 'react';

export interface SavedVideo {
  id: string;
  url: string;
  timestamp: number;
  duration: number;
  mimeType: string;
}

export const useCamera = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recorderState, setRecorderState] = useState<'inactive' | 'recording' | 'paused'>('inactive');
  const [recordings, setRecordings] = useState<SavedVideo[]>([]);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [targetFPS, setTargetFPS] = useState(30);
  const [systemHealth, setSystemHealth] = useState<'nominal' | 'warning' | 'critical'>('nominal');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frozenCountRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const pauseStartRef = useRef<number>(0);
  const lastChunkTimeRef = useRef<number>(0);

  // GLOBAL PUMP: Force the browser to keep rendering nodes active
  useEffect(() => {
    let pumpTimer: number;
    const pump = () => {
      if (stream && videoRef.current) {
        if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas');
          canvasRef.current.width = 1;
          canvasRef.current.height = 1;
        }
        const ctx = canvasRef.current.getContext('2d', { alpha: false, desynchronized: true });
        if (ctx && videoRef.current.readyState >= 2) {
          // Drawing forces the frame buffer to stay decoded even in background
          ctx.drawImage(videoRef.current, 0, 0, 1, 1);
        }
      }
    };

    if (stream) {
      pumpTimer = window.setInterval(pump, 33); // 30fps high-priority heartbeat
    }
    return () => clearInterval(pumpTimer);
  }, [stream]);

  // TIERED RECOVERY: Automated health watchdog
  useEffect(() => {
    let watchdog: number;
    const check = async () => {
      if (recorderState === 'recording' && videoRef.current && mediaRecorderRef.current) {
        const video = videoRef.current;
        const currentTime = video.currentTime;
        
        // If time is not advancing
        if (currentTime === lastTimeRef.current && !video.paused) {
          frozenCountRef.current += 1;
          console.warn(`[Tiered Recovery] Frozen detected: ${frozenCountRef.current}/30s`);
          
          // L1: Request data every 2s of freeze
          if (frozenCountRef.current % 10 === 0) {
            console.log('L1 Recovery: Forcing encoder flush...');
            mediaRecorderRef.current.requestData();
          }
          
          // L2: srcObject Flash (5s freeze)
          if (frozenCountRef.current === 25) {
            console.log('L2 Recovery: Re-seating srcObject...');
            const currentStream = video.srcObject;
            video.srcObject = null;
            video.srcObject = currentStream;
            video.play().catch(() => {});
          }

          // L3: Hard Reboot (10s freeze)
          if (frozenCountRef.current >= 50) {
            console.error('L3 Recovery: HARD RESTART TRIGGERED');
            // Force a recording stop and camera reset
            setSystemHealth('critical');
            if (isRecording) {
              mediaRecorderRef.current.stop();
            }
          }
        } else {
          frozenCountRef.current = 0;
          setSystemHealth('nominal');
        }
        lastTimeRef.current = currentTime;
      }
    };

    if (recorderState === 'recording') {
      watchdog = window.setInterval(check, 200);
    }
    return () => clearInterval(watchdog);
  }, [recorderState]);

  const startCamera = useCallback(async (mode?: 'user' | 'environment', quality?: '720p' | '1080p', frameRate?: number) => {
    const activeMode = mode || facingMode;
    const currentFPS = frameRate || 30;
    setTargetFPS(currentFPS);
    const targetWidth = quality === '1080p' ? 1920 : 1280;
    const targetHeight = quality === '1080p' ? 1080 : 720;
    
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
    }
    setStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.load(); // Force release
    }
    
    // Give hardware a moment to settle
    await new Promise(resolve => setTimeout(resolve, 200));

    try {
      setSystemHealth('nominal');
      const constraints: MediaStreamConstraints = {
        video: { 
          facingMode: activeMode, 
          width: { ideal: targetWidth }, 
          height: { ideal: targetHeight },
          frameRate: { ideal: targetFPS }
        },
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: false }, // Disable aggressive suppression for better quality
          autoGainControl: { ideal: true },
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 2 }
        },
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Handle system interruptions (Control Center, backgrounding)
      newStream.getTracks().forEach(track => {
        track.onmute = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            console.log('Operational Halt: System resource lock detected');
            mediaRecorderRef.current.pause();
          }
        };
        track.onunmute = async () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            console.log('Resource Restored: Synching stream...');
            // Optional: check if track is actually producing data
            if (track.readyState === 'live') {
              mediaRecorderRef.current.resume();
            } else {
              console.warn('Track stuck in dead state, attempting recovery');
            }
          }
        };
        // If track ends unexpectedly
        track.onended = () => {
          if (isRecording) {
            console.warn('Track ended unexpectedly while recording');
            // We should stop recording or try to recover? For now, stop to save data
            stopRecording();
          }
        };
      });

      setStream(newStream);
      setFacingMode(activeMode);
      
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = newStream;
        
        // Add listeners to ensure video keeps playing during/after PiP transitions
        video.onenterpictureinpicture = () => {
          video.muted = false; // Ensure unmuted to keep rendering engine high priority
          video.play().catch(() => {});
        };
        
        video.onleavepictureinpicture = () => {
          // CRITICAL: Some browsers pause video when exiting PiP
          // We use a sequence of play attempts to wake up the engine
          const wakeUp = () => {
            if (video.srcObject) {
              video.play().catch(() => {
                // If direct play fails, re-seat the source
                const currentStream = video.srcObject;
                video.srcObject = null;
                video.srcObject = currentStream;
                video.play().catch(() => {});
              });
            }
          };
          
          wakeUp();
          setTimeout(wakeUp, 100);
          setTimeout(wakeUp, 500);
        };

        // Listen for stream death (e.g., system-level camera takeover)
        newStream.addEventListener('inactive', () => {
          console.warn('Camera stream became inactive. Attempting automatic recovery...');
        });

        newStream.getTracks().forEach(track => {
          track.onended = () => {
            console.warn('Camera track ended unexpectedly.');
          };
        });

        // Aggressive play
        video.play().catch(e => console.warn('Initial play blocked:', e));
      }
      return newStream;
    } catch (err) {
      console.error('Error accessing camera:', err);
      // Fallback: Try with just camera if audio fails
      if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        throw err; // User blocked, don't retry automatically
      }
      
      console.log('Falling back to basic constraints...');
      return await navigator.mediaDevices.getUserMedia({ video: { facingMode: activeMode }, audio: true });
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const switchCamera = useCallback(async (qualitySetting?: '720p' | '1080p', fpsSetting?: number) => {
    if (isRecording) return;
    
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    
    // Kill existing completely
    if (stream) {
      stream.getTracks().forEach(t => {
        t.stop();
        t.enabled = false;
      });
    }
    setStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.load();
    }

    // Small delay to let hardware release
    await new Promise(r => setTimeout(r, 400));
    
    await startCamera(nextMode, qualitySetting, fpsSetting);
  }, [facingMode, isRecording, startCamera, stream]);

  const startRecording = useCallback((qualitySetting?: '720p' | '1080p') => {
    if (!stream || !videoRef.current) return;

    chunksRef.current = [];
    
    const mimeTypes = [
      'video/mp4;codecs=h264,aac',
      'video/webm;codecs=h264,opus',
      'video/mp4',
      'video/webm',
    ];
    
    const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
    
    // THE STABILITY FIX: HYBRID STREAM CONSTRUCTION
    // 1. Capture Video from the rendering element (PiP works, so this is high confidence)
    // 2. Take Audio from the original source stream (highest fidelity)
    const combinedStream = new MediaStream();
    
    if (videoRef.current && typeof videoRef.current.captureStream === 'function') {
      // @ts-ignore
      const capturedVideoStream = videoRef.current.captureStream(targetFPS);
      capturedVideoStream.getVideoTracks().forEach((track: MediaStreamTrack) => {
        combinedStream.addTrack(track);
      });
    } else {
      // Fallback: use raw stream tracks
      stream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
    }
    
    // CRITICAL: Always attach original audio tracks to ensure sound presence
    stream.getAudioTracks().forEach(track => combinedStream.addTrack(track));

    // High Fidelity Bitrate (10-12 Mbps for 1080p, 5-6 Mbps for 720p)
    const videoBitrate = qualitySetting === '1080p' ? 12000000 : 8000000;
    const audioBitrate = 128000; // 128 kbps for high quality audio

    const mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType: supportedMimeType,
      videoBitsPerSecond: videoBitrate,
      audioBitsPerSecond: audioBitrate,
    });

    // WATCHDOG: Health check - ensure data Is actually being produced
    const watchdogInterval = window.setInterval(() => {
      const timeSinceLastChunk = Date.now() - lastChunkTimeRef.current;
      if (mediaRecorder.state === 'recording' && timeSinceLastChunk > 3000) {
        console.warn('Watchdog: Recording stalled. Requesting data...');
        mediaRecorder.requestData();
      }
    }, 2000);

    mediaRecorder.onpause = () => {
      pauseStartRef.current = Date.now();
      setRecorderState('paused');
    };

    mediaRecorder.onresume = () => {
      if (pauseStartRef.current > 0) {
        pausedTimeRef.current += (Date.now() - pauseStartRef.current);
        pauseStartRef.current = 0;
      }
      setRecorderState('recording');
    };

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        // Sync start time to the VERY FIRST actual data chunk to avoid leading gaps
        if (chunksRef.current.length === 0) {
          startTimeRef.current = Date.now();
        }
        
        lastChunkTimeRef.current = Date.now();
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      clearInterval(watchdogInterval);
      setRecorderState('inactive');
      
      // If no data was captured, don't save a bogus recording
      if (chunksRef.current.length === 0) {
        console.warn('Recording stopped with no data chunks. Discarding.');
        return;
      }

      const blob = new Blob(chunksRef.current, { type: supportedMimeType });
      const url = URL.createObjectURL(blob);
      
      const now = Date.now();
      
      // CRITICAL FIX: If startTimeRef was never set (no data), use a safe fallback
      // 1988 hours usually comes from Date(0)... we must prevent this.
      const hasData = chunksRef.current.length > 0;
      const effectiveStart = (startTimeRef.current > 0 && hasData) ? startTimeRef.current : now;
      
      let finalPausedTime = pausedTimeRef.current;
      if (pauseStartRef.current > 0) {
        finalPausedTime += (now - pauseStartRef.current);
      }
      
      let rawDuration = now - effectiveStart - finalPausedTime;
      
      // If the math results in something crazy, or no chunks exist
      if (!hasData || rawDuration < 0 || rawDuration > 86400000) {
        // Fallback to estimation based on chunks (we request data every 1000ms)
        rawDuration = chunksRef.current.length * 1000;
      }

      const duration = Math.max(0, Math.min(rawDuration, 86400000));
      
      const newVideo: SavedVideo = {
        id: Math.random().toString(36).substr(2, 9),
        url,
        timestamp: Date.now(),
        duration,
        mimeType: supportedMimeType
      };
      
      setRecordings(prev => [newVideo, ...prev]);
    };

    mediaRecorderRef.current = mediaRecorder;
    startTimeRef.current = Date.now(); 
    pausedTimeRef.current = 0;
    pauseStartRef.current = 0;
    lastChunkTimeRef.current = Date.now();
    // Request data every 1000ms to keep the recording process active
    mediaRecorder.start(1000);
    setIsRecording(true);
    setRecorderState('recording');
  }, [stream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (!document.pictureInPictureEnabled) {
      console.warn('PiP is not enabled in this browser context');
      return;
    }

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      }

      // Ensure metadata is loaded before requesting PiP
      if (video.readyState < 1) {
        await new Promise((resolve, reject) => {
          const handler = () => {
            clearTimeout(timeoutId);
            resolve(true);
          };
          
          const timeoutId = setTimeout(() => {
            video.removeEventListener('loadedmetadata', handler);
            reject(new Error('Metadata timeout'));
          }, 8000); // Increase to 8s for standalone mode

          video.addEventListener('loadedmetadata', handler, { once: true });
          
          // Also check if we can already play
          if (video.readyState >= 1) handler();
        });
      }

      await video.requestPictureInPicture();
    } catch (err) {
      console.error('PiP Error:', err);
    }
  }, []);

  const removeRecording = useCallback((id: string) => {
    setRecordings(prev => {
      const video = prev.find(v => v.id === id);
      if (video) URL.revokeObjectURL(video.url);
      return prev.filter(v => v.id !== id);
    });
  }, []);

  return {
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
    status: systemHealth,
    removeRecording,
    setRecordings,
    mediaRecorderRef
  };
};

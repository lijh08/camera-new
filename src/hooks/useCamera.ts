import { useState, useRef, useCallback } from 'react';

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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const pauseStartRef = useRef<number>(0);

  const startCamera = useCallback(async (mode?: 'user' | 'environment', quality?: '720p' | '1080p', frameRate?: number) => {
    const activeMode = mode || facingMode;
    const targetWidth = quality === '1080p' ? 1920 : 1280;
    const targetHeight = quality === '1080p' ? 1080 : 720;
    const targetFPS = frameRate || 30;
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    // Ensure both camera and microphone are requested as per user's strict requirement
    try {
      const constraints: MediaStreamConstraints = {
        video: { 
          facingMode: activeMode, 
          width: { ideal: targetWidth }, 
          height: { ideal: targetHeight },
          frameRate: { ideal: targetFPS }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true
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
        videoRef.current.srcObject = newStream;
        // Aggressive play
        videoRef.current.play().catch(e => console.warn('Initial play blocked:', e));
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
    
    // Hard stop all tracks
    if (stream) {
      stream.getTracks().forEach(t => {
        t.stop();
        t.enabled = false;
      });
    }
    setStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;

    // Small delay to let hardware release
    await new Promise(r => setTimeout(r, 300));
    
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
    
    // Use the direct MediaStream to avoid "Screen Recording" prompts caused by captureStream
    const streamToRecord = stream;

    // Optimal Bitrate
    const videoBitrate = qualitySetting === '1080p' ? 8000000 : 4000000;

    const mediaRecorder = new MediaRecorder(streamToRecord, {
      mimeType: supportedMimeType,
      videoBitsPerSecond: videoBitrate,
    });

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
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      setRecorderState('inactive');
      const blob = new Blob(chunksRef.current, { type: supportedMimeType });
      const url = URL.createObjectURL(blob);
      
      // Calculate real duration excluding pause time
      const now = Date.now();
      let finalPausedTime = pausedTimeRef.current;
      if (pauseStartRef.current > 0) {
        finalPausedTime += (now - pauseStartRef.current);
      }
      
      const rawDuration = now - startTimeRef.current - finalPausedTime;
      // Sanity check: duration cannot be negative or absurdly long (e.g., > 24 hours for a single clip)
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
    switchCamera,
    setRecordings,
    mediaRecorderRef
  };
};

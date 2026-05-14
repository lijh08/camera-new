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
  const [recordings, setRecordings] = useState<SavedVideo[]>([]);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const startTimeRef = useRef<number>(0);

  const startCamera = useCallback(async (mode?: 'user' | 'environment', quality?: '720p' | '1080p', frameRate?: number) => {
    const activeMode = mode || facingMode;
    const targetWidth = quality === '1080p' ? 1920 : 1280;
    const targetHeight = quality === '1080p' ? 1080 : 720;
    const targetFPS = frameRate || 30;

    // Ensure both camera and microphone are requested as per user's strict requirement
    try {
      const constraints: MediaStreamConstraints = {
        video: { 
          facingMode: activeMode, 
          width: { ideal: targetWidth }, 
          height: { ideal: targetHeight },
          frameRate: { 
            ideal: targetFPS,
            min: targetFPS === 60 ? 30 : 15 // Allow some flexibility to prevent crash
          }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setStream(newStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        // Aggressive play
        videoRef.current.play().catch(e => console.warn('Initial play blocked:', e));
      }
      return newStream;
    } catch (err) {
      console.error('Error accessing camera:', err);
      // Fallback for strict constraints failure
      if (quality === '1080p' || frameRate === 60) {
        console.log('Falling back to standard constraints...');
        return startCamera(mode, '720p', 30);
      }
      throw err;
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);

  const switchCamera = useCallback(async (qualitySetting?: '720p' | '1080p', fpsSetting?: number) => {
    if (isRecording) {
      console.warn('Cannot switch camera while recording');
      return;
    }

    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);

    // Stop current stream
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    // Start with new mode
    await startCamera(nextMode, qualitySetting, fpsSetting);
  }, [facingMode, stream, isRecording, startCamera]);

  const startRecording = useCallback((qualitySetting?: '720p' | '1080p') => {
    if (!stream || !videoRef.current) return;

    chunksRef.current = [];
    
    const mimeTypes = [
      'video/mp4;codecs=h264,aac',
      'video/webm;codecs=h264,opus',
      'video/webm;codecs=vp9,opus',
      'video/mp4',
      'video/webm',
    ];
    
    const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
    
    // Crucial: Use a high-quality Canvas/Video capture stream if in PiP to keep frames alive,
    // but ALWAYS manually merge the original high-fidelity audio track.
    let streamToRecord: MediaStream;
    const video = videoRef.current;

    try {
      if ((video as any).captureStream) {
        // Create a new stream for recording
        const visualStream = (video as any).captureStream(60); // Match max requested FPS
        const combinedStream = new MediaStream();
        
        // Add visual tracks
        visualStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
        
        // Add ORIGINAL audio tracks (bypass the element's mute/state)
        stream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
        
        streamToRecord = combinedStream;
      } else {
        streamToRecord = stream;
      }
    } catch (e) {
      console.warn('Advanced stream composition failed, using direct stream:', e);
      streamToRecord = stream;
    }

    // Optimal Bitrate for High Fidelity (6-12 Mbps for 1080p)
    const videoBitrate = qualitySetting === '1080p' ? 8000000 : 4000000;

    const mediaRecorder = new MediaRecorder(streamToRecord, {
      mimeType: supportedMimeType,
      videoBitsPerSecond: videoBitrate,
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: supportedMimeType });
      const url = URL.createObjectURL(blob);
      const duration = Date.now() - startTimeRef.current;
      
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
    // Request data every 1000ms to keep the recording process active
    mediaRecorder.start(1000);
    setIsRecording(true);
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

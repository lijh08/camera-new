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
    try {
      const activeMode = mode || facingMode;
      const targetWidth = quality === '1080p' ? 1920 : 1280;
      const targetHeight = quality === '1080p' ? 1080 : 720;
      const targetFPS = frameRate || 30;

      // Ensure both camera and microphone are requested as per user's strict requirement
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: activeMode, 
          width: { ideal: targetWidth }, 
          height: { ideal: targetHeight },
          frameRate: { ideal: targetFPS }
        },
        audio: true,
      });
      
      setStream(newStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        // Aggressive play
        videoRef.current.play().catch(e => console.warn('Initial play blocked:', e));
      }
      return newStream;
    } catch (err) {
      console.error('Error accessing camera:', err);
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

  const switchCamera = useCallback(async (quality?: '720p' | '1080p', frameRate?: number) => {
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
    await startCamera(nextMode, quality, frameRate);
  }, [facingMode, stream, isRecording, startCamera]);

  const startRecording = useCallback(() => {
    if (!stream || !videoRef.current) return;

    chunksRef.current = [];
    
    const mimeTypes = [
      'video/mp4;codecs=h264,aac',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm',
    ];
    
    const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
    
    // Use captureStream from the video element if available.
    // This ensures that if the PiP window is moving (the video element is rendering), 
    // the recorder gets those exact frames. It's more resilient on mobile browsers.
    let streamToRecord: MediaStream = stream;
    try {
      if ((videoRef.current as any).captureStream) {
        // Force 30fps capture from the video element to prevent encoder stalling
        streamToRecord = (videoRef.current as any).captureStream(30);
        // captureStream() might not include the audio tracks from the original stream
        // on all browsers, so we add them manually to ensure audio is recorded.
        stream.getAudioTracks().forEach(track => {
          streamToRecord.addTrack(track);
        });
      }
    } catch (e) {
      console.warn('captureStream failed, falling back to direct stream recording:', e);
      streamToRecord = stream;
    }

    const mediaRecorder = new MediaRecorder(streamToRecord, {
      mimeType: supportedMimeType,
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
          }, 5000); // Increase to 5s

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

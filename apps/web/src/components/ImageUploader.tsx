import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Link as LinkIcon, X } from 'lucide-react';
import { api } from '@/lib/api';

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

export function ImageUploader({ value, onChange, label = 'Photo' }: ImageUploaderProps) {
  const [mode, setMode] = useState<'url' | 'upload' | 'camera' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const startCamera = async () => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setMode('camera');
    } catch (err) {
      setError('Camera access denied or unavailable.');
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], 'capture.png', { type: 'image/png' });
            await handleUpload(file);
            stopCamera();
          }
        }, 'image/png');
      }
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const res = await api.uploadFile(file);
      onChange(res.url);
      setMode(null);
    } catch (err) {
      setError('Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUpload(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      
      {value ? (
        <div className="relative inline-block border rounded-md p-1 bg-muted/50">
          <img src={value} alt={label} className="h-32 w-32 object-cover rounded-md" />
          <button
            type="button"
            onClick={() => { onChange(''); setMode(null); }}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {!mode && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMode('upload')}
                className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-md shadow-sm text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                <Upload className="w-4 h-4 text-muted-foreground" /> Upload File
              </button>
              
              <button
                type="button"
                onClick={startCamera}
                className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-md shadow-sm text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                <Camera className="w-4 h-4 text-muted-foreground" /> Use Camera
              </button>
              
              <button
                type="button"
                onClick={() => setMode('url')}
                className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-md shadow-sm text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                <LinkIcon className="w-4 h-4 text-muted-foreground" /> Provide URL
              </button>
            </div>
          )}

          {mode === 'url' && (
            <div className="flex gap-2 items-center">
              <input
                type="url"
                placeholder="https://example.com/photo.jpg"
                className="flex-1 rounded-md border-border shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border outline-none"
                onBlur={(e) => {
                  if (e.target.value) {
                    onChange(e.target.value);
                    setMode(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.currentTarget.value) {
                      onChange(e.currentTarget.value);
                      setMode(null);
                    }
                  }
                }}
              />
              <button type="button" onClick={() => setMode(null)} className="text-muted-foreground hover:text-foreground text-sm font-medium">Cancel</button>
            </div>
          )}

          {mode === 'upload' && (
            <div className="flex gap-2 items-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-blue-100 transition-colors cursor-pointer"
                disabled={uploading}
              />
              {uploading && <span className="text-sm text-muted-foreground animate-pulse font-medium">Uploading...</span>}
              <button type="button" onClick={() => setMode(null)} className="text-muted-foreground hover:text-foreground text-sm font-medium ml-auto">Cancel</button>
            </div>
          )}

          {mode === 'camera' && (
            <div className="flex flex-col gap-2 border rounded-md p-2 bg-muted/50 shadow-sm">
              <div className="relative bg-black rounded-md overflow-hidden flex items-center justify-center min-h-[240px]">
                <video ref={videoRef} autoPlay playsInline className="max-w-full max-h-[300px]" />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <div className="flex justify-between items-center px-1">
                <button type="button" onClick={() => { stopCamera(); setMode(null); }} className="text-muted-foreground hover:text-foreground text-sm font-medium">Cancel</button>
                <button
                  type="button"
                  onClick={captureImage}
                  disabled={uploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {uploading ? 'Processing...' : <><Camera className="w-4 h-4" /> Capture</>}
                </button>
              </div>
            </div>
          )}
          
          {error && <p className="text-red-500 text-sm font-medium bg-red-50 p-2 rounded-md">{error}</p>}
        </div>
      )}
    </div>
  );
}

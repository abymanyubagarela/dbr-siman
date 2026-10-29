"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { setPageLoading } from "@/components/ui/PageLoader";

interface Props {
  sessionId: string;
  assetId: string;
  onPhotoCaptured: () => void;
  onCancel: () => void;
}

export default function PhotoCapture({
  sessionId,
  assetId,
  onPhotoCaptured,
  onCancel,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  useEffect(() => { setPageLoading(uploading); }, [uploading]);
  const [error, setError] = useState("");

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError("Unable to access camera. Please check permissions.");
      console.error("Camera access error:", err);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const imageData = canvasRef.current.toDataURL("image/jpeg");
        setCapturedImage(imageData);
      }
    }
  };

  const uploadPhoto = async () => {
    if (!capturedImage) return;

    setUploading(true);
    try {
      // Convert data URL to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();

      // Upload to Supabase Storage
      const fileName = `${sessionId}/${assetId}-${Date.now()}.jpg`;
      const { data, error: uploadError } = await supabase.storage
        .from("inventory-photos")
        .upload(fileName, blob, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("inventory-photos")
        .getPublicUrl(fileName);

      // Update inventory item with image URL and status
      const { error: updateError } = await supabase
        .from("inventory_items")
        .update({
          image_url: urlData.publicUrl,
          status: "photographed",
        })
        .eq("session_id", sessionId)
        .eq("asset_id", assetId);

      if (updateError) throw updateError;

      setCapturedImage(null);
      onPhotoCaptured();
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 border-2 border-red-500">
        <h2 className="text-2xl font-bold mb-4 text-red-600">Camera Error</h2>
        <p className="text-foreground mb-4">{error}</p>
        <button
          onClick={onCancel}
          className="w-full py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition"
        >
          Back to Scanning
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border-2 border-primary">
        <div className="p-4 bg-foreground/5">
          <p className="text-sm font-medium text-foreground">
            Asset ID: {assetId}
          </p>
        </div>

        {!capturedImage ? (
          <div className="aspect-video bg-black relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-4 right-4 px-3 py-2 bg-white/20 text-white text-sm rounded-lg hover:bg-white/30 transition"
            >
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    setCapturedImage(event.target?.result as string);
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="hidden"
            />
          </div>
        ) : (
          <div className="aspect-video bg-black relative">
            <img
              src={capturedImage}
              alt="Captured"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="p-6 space-y-3">
          {!capturedImage ? (
            <>
              <button
                onClick={capturePhoto}
                className="w-full py-4 bg-accent text-white font-bold rounded-lg hover:bg-accent/90 transition text-lg"
              >
                📸 Capture Photo
              </button>
              <button
                onClick={onCancel}
                className="w-full py-3 bg-secondary text-foreground font-semibold rounded-lg hover:bg-secondary/80 transition"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={uploadPhoto}
                disabled={uploading}
                className="w-full py-4 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 disabled:bg-primary/50 transition text-lg"
              >
                {uploading ? "Uploading..." : "✓ Confirm & Save"}
              </button>
              <button
                onClick={retakePhoto}
                className="w-full py-3 bg-secondary text-foreground font-semibold rounded-lg hover:bg-secondary/80 transition"
              >
                Retake Photo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

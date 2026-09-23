"use client";

import React, { useState, useRef } from "react";
import { X, UploadCloud, Image as ImageIcon, AlertCircle, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditCoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCoverUrl?: string | null;
  onCoverApplied: (coverUrl: string) => void;
}

export function EditCoverModal({
  isOpen,
  onClose,
  currentCoverUrl,
  onCoverApplied,
}: EditCoverModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(false);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (!validTypes.includes(file.type.toLowerCase())) {
      setError("Please select a valid image file (JPG, JPEG, PNG, or WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size exceeds 5MB. Please choose a smaller photo.");
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleApply = () => {
    if (!previewUrl) {
      setError("Please select an image first.");
      return;
    }

    setSuccess(true);
    onCoverApplied(previewUrl);

    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-cover-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#0B1515] p-6 shadow-xl border border-[#203131] space-y-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#203131] pb-4">
          <div>
            <h2 id="edit-cover-title" className="text-xl font-bold text-[#F5F7F6]">
              Edit Cover Photo
            </h2>
            <p className="text-xs text-[#81918E] mt-0.5">
              Upload and preview a custom header banner for your profile.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-xl p-1.5 text-[#81918E] hover:bg-[#132020] hover:text-[#F5F7F6] transition-colors focus:outline-none focus:ring-2 focus:ring-[#66C56A]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Feedback Messages */}
        {success && (
          <div className="flex items-center gap-2 rounded-xl bg-[#101C1C] p-3 text-sm text-[#66C56A] border border-[#2E7D32]/40">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#66C56A]" />
            <span>Cover photo applied to profile preview!</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-950/40 p-3 text-sm text-rose-300 border border-rose-900">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Preview Area */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
            Banner Preview
          </label>
          <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-[#203131] bg-[#101C1C]">
            {previewUrl || currentCoverUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewUrl || currentCoverUrl || ""}
                alt="Profile Cover Preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="cover-theme-banner flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#163D23] to-[#2E7D32] text-white">
                <ImageIcon className="h-8 w-8 text-emerald-200 mb-1.5" />
                <span className="text-xs font-semibold text-emerald-100">Default VehiCare Theme Banner</span>
              </div>
            )}
          </div>
        </div>

        {/* File Input Selection Box */}
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            id="cover-file-input"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileChange}
            className="sr-only"
            aria-label="Upload Cover Image File"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            tabIndex={0}
            role="button"
            aria-label="Click to browse image files"
            className="cover-dropzone flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#203131] bg-[#101C1C] p-6 text-center cursor-pointer hover:border-[#66C56A]/50 hover:bg-[#132020] transition-all focus:outline-none focus:ring-2 focus:ring-[#66C56A]"
          >
            <div className="cover-upload-icon flex h-12 w-12 items-center justify-center rounded-2xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30 mb-2">
              <UploadCloud className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-[#F5F7F6]">
              {selectedFile ? selectedFile.name : "Click to select a photo"}
            </p>
            <p className="text-xs text-[#81918E] mt-1">
              Supports JPG, JPEG, PNG, and WEBP (Max 5MB)
            </p>
          </div>

          <div className="flex items-center justify-between text-xs text-[#81918E]">
            <span className="italic">
              * Frontend Demo: Instant local preview in state.
            </span>
            {previewUrl && (
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1 text-[#B8C4C2] hover:text-[#F5F7F6] font-medium"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#203131]">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="form-cancel-btn rounded-xl border-[#203131] bg-[#132020] text-[#F5F7F6] hover:bg-[#132020]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={!previewUrl || success}
            className="rounded-xl bg-[#2E7D32] text-white hover:bg-[#256628] shadow-xs min-w-[120px] disabled:opacity-50"
          >
            Apply Cover
          </Button>
        </div>
      </div>
    </div>
  );
}

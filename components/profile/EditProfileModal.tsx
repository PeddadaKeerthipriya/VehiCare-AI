"use client";

import React, { useState } from "react";
import { X, Loader2, CheckCircle2, AlertCircle, User, Phone, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  initialPhone: string;
  initialRole: string;
  onProfileUpdated: (updated: { name: string; phone: string; role: string }) => void;
}

export function EditProfileModal({
  isOpen,
  onClose,
  initialName,
  initialPhone,
  initialRole,
  onProfileUpdated,
}: EditProfileModalProps) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [role, setRole] = useState(initialRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!name.trim()) {
      errors.name = "Full Name is required.";
    }
    if (!phone.trim()) {
      errors.phone = "Phone number is required.";
    } else if (!/^[+0-9\s-]{7,16}$/.test(phone.trim())) {
      errors.phone = "Please enter a valid phone number (e.g. +91 98765 43210).";
    }
    if (!role.trim()) {
      errors.role = "Role is required.";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!validate()) return;

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: name.trim(),
          phone: phone.trim(),
          role: role.trim(),
        },
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      onProfileUpdated({
        name: name.trim(),
        phone: phone.trim(),
        role: role.trim(),
      });

      setTimeout(() => {
        onClose();
      }, 750);
    } catch (err: unknown) {
      console.error("Error updating profile:", err);
      const errMsg = err instanceof Error ? err.message : "Failed to update profile. Please try again.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#0B1515] p-6 shadow-xl border border-[#203131] space-y-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#203131] pb-4">
          <div>
            <h2 id="edit-profile-title" className="text-xl font-bold text-[#F5F7F6]">
              Edit Profile
            </h2>
            <p className="text-xs text-[#81918E] mt-0.5">
              Update your personal details and account role.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
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
            <span>Profile details updated successfully!</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-950/40 p-3 text-sm text-rose-300 border border-rose-900">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1">
            <label
              htmlFor="profile-fullname"
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]"
            >
              <User className="h-3.5 w-3.5 text-[#66C56A]" />
              Full Name *
            </label>
            <input
              id="profile-fullname"
              type="text"
              disabled={loading || success}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] placeholder:text-[#81918E] outline-none transition-all focus:bg-[#132020] ${
                validationErrors.name
                  ? "border-rose-500 focus:ring-1 focus:ring-rose-500"
                  : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
              }`}
            />
            {validationErrors.name && (
              <p className="text-xs text-rose-400 mt-1">{validationErrors.name}</p>
            )}
          </div>

          {/* Phone Number */}
          <div className="space-y-1">
            <label
              htmlFor="profile-phone"
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]"
            >
              <Phone className="h-3.5 w-3.5 text-[#66C56A]" />
              Phone Number *
            </label>
            <input
              id="profile-phone"
              type="tel"
              disabled={loading || success}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] placeholder:text-[#81918E] outline-none transition-all focus:bg-[#132020] ${
                validationErrors.phone
                  ? "border-rose-500 focus:ring-1 focus:ring-rose-500"
                  : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
              }`}
            />
            {validationErrors.phone && (
              <p className="text-xs text-rose-400 mt-1">{validationErrors.phone}</p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-1">
            <label
              htmlFor="profile-role"
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]"
            >
              <Briefcase className="h-3.5 w-3.5 text-[#66C56A]" />
              Driver / Account Role *
            </label>
            <select
              id="profile-role"
              disabled={loading || success}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-xl border border-[#203131] bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none transition-all focus:bg-[#132020] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
            >
              <option value="Owner / Primary Driver">Owner / Primary Driver</option>
              <option value="Fleet Manager">Fleet Manager</option>
              <option value="Secondary Driver">Secondary Driver</option>
              <option value="Vehicle Enthusiast">Vehicle Enthusiast</option>
            </select>
          </div>

          <p className="text-[11px] text-[#81918E] italic">
            * Note: Full Name is synchronized with your Supabase Auth user metadata. Phone and role are saved to account profile state.
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#203131]">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border-[#203131] bg-[#132020] text-[#F5F7F6] hover:bg-[#132020]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || success}
              className="rounded-xl bg-[#2E7D32] text-white hover:bg-[#256628] shadow-xs min-w-[120px]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

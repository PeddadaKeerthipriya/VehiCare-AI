"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

export default function ChangePasswordPage() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch current authenticated user email
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        setUserEmail(user.email);
      }
    };

    checkUser();
  }, []);

  // Password Requirements Evaluation
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(
    newPassword
  );

  const requirementsMetCount = [
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar,
  ].filter(Boolean).length;

  const isAllRequirementsMet =
    hasMinLength &&
    hasUppercase &&
    hasLowercase &&
    hasNumber &&
    hasSpecialChar;

  // Password Strength Determination
  const getPasswordStrength = () => {
    if (!newPassword) {
      return { score: 0, label: "", color: "bg-transparent", textColor: "" };
    }

    if (requirementsMetCount <= 1) {
      return {
        score: 1,
        label: "Weak",
        color: "bg-rose-500",
        textColor: "text-rose-400",
      };
    }

    if (requirementsMetCount <= 3) {
      return {
        score: 2,
        label: "Fair",
        color: "bg-amber-500",
        textColor: "text-amber-400",
      };
    }

    if (requirementsMetCount === 4) {
      return {
        score: 3,
        label: "Good",
        color: "bg-blue-500",
        textColor: "text-blue-400",
      };
    }

    return {
      score: 4,
      label: "Strong",
      color: "bg-[#66C56A]",
      textColor: "text-[#66C56A]",
    };
  };

  const strength = getPasswordStrength();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Client-Side Validations
    if (!currentPassword) {
      setError("Please enter your current password.");
      return;
    }

    if (!newPassword) {
      setError("Please enter your new password.");
      return;
    }

    if (!isAllRequirementsMet) {
      setError("Please ensure your new password meets all security requirements.");
      return;
    }

    if (!confirmPassword) {
      setError("Please confirm your new password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation password do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    setLoading(true);

    try {
      // 2. Verify current password if user email is known
      if (userEmail) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: currentPassword,
        });

        if (signInError) {
          setError("Current password is incorrect. Please verify and try again.");
          setLoading(false);
          return;
        }
      }

      // 3. Update password using existing Supabase client
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(
          updateError.message || "Failed to update password. Please try again."
        );
        setLoading(false);
        return;
      }

      // 4. Success State
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError(
        "A network error occurred while updating your password. Please check your connection."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Back Link */}
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#81918E] hover:text-[#F5F7F6] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Settings</span>
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#F5F7F6]">
          Change Password
        </h1>
        <p className="text-sm text-[#81918E] mt-1">
          Update your credentials and enhance account security
        </p>
      </div>

      {/* Success View */}
      {success ? (
        <Card className="border-[#203131] bg-[#0B1515] rounded-2xl shadow-xl overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center p-8 sm:p-10 text-center space-y-4">
            <div className="rounded-2xl bg-[#101C1C] p-4 text-[#66C56A] border border-[#2E7D32]/40">
              <ShieldCheck className="h-10 w-10" />
            </div>

            <div className="space-y-1 max-w-md">
              <CardTitle className="text-xl font-bold text-[#F5F7F6]">
                Password updated successfully.
              </CardTitle>
              <CardDescription className="text-xs text-[#81918E]">
                Your account password has been updated. You can now use your new password for future sign-ins.
              </CardDescription>
            </div>

            <div className="pt-2">
              <Button
                onClick={() => router.push("/settings")}
                className="rounded-xl bg-[#2E7D32] hover:bg-[#256628] text-white font-semibold text-xs h-10 px-5 shadow-xs flex items-center gap-2"
              >
                Back to Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Change Password Card & Form */
        <Card className="border-[#203131] bg-[#0B1515] rounded-2xl shadow-xl overflow-hidden">
          <CardHeader className="p-5 sm:p-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-bold text-[#F5F7F6]">
                  Account Credentials
                </CardTitle>
                <CardDescription className="text-xs text-[#81918E] mt-0.5">
                  Enter your current password and choose a strong new password
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="p-5 sm:p-6 pt-0 space-y-4">
              {/* Error Message */}
              {error && (
                <div className="rounded-xl bg-rose-950/40 border border-rose-900 p-3.5 text-xs text-rose-300 font-medium flex items-center gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Current Password Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                  Current Password *
                </label>

                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-[#81918E]" />

                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    name="current-password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                    disabled={loading}
                    className="w-full rounded-xl border border-[#203131] bg-[#101C1C] h-11 pl-10 pr-11 text-sm text-[#F5F7F6] placeholder:text-[#81918E] outline-none transition-all focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                  />

                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    aria-label={
                      showCurrentPassword
                        ? "Hide current password"
                        : "Show current password"
                    }
                    className="absolute right-3.5 top-3.5 text-[#81918E] hover:text-[#F5F7F6] transition-colors"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* New Password Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                  New Password *
                </label>

                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-[#81918E]" />

                  <input
                    type={showNewPassword ? "text" : "password"}
                    name="new-password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new strong password"
                    required
                    disabled={loading}
                    className="w-full rounded-xl border border-[#203131] bg-[#101C1C] h-11 pl-10 pr-11 text-sm text-[#F5F7F6] placeholder:text-[#81918E] outline-none transition-all focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                  />

                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    aria-label={
                      showNewPassword
                        ? "Hide new password"
                        : "Show new password"
                    }
                    className="absolute right-3.5 top-3.5 text-[#81918E] hover:text-[#F5F7F6] transition-colors"
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {newPassword && (
                  <div className="pt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#81918E]">Password Strength:</span>
                      <span className={`font-bold ${strength.textColor}`}>
                        {strength.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 h-1.5">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={`strength-step-${step}`}
                          className={`h-full rounded-full transition-all ${
                            step <= strength.score
                              ? strength.color
                              : "bg-[#203131]"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Live Password Requirements Checklist */}
              <div className="rounded-xl border border-[#203131] bg-[#101C1C] p-4 space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#B8C4C2]">
                  Password Requirements
                </p>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    {hasMinLength ? (
                      <CheckCircle2 className="h-4 w-4 text-[#66C56A] shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-[#81918E] shrink-0" />
                    )}
                    <span
                      className={
                        hasMinLength ? "text-[#F5F7F6] font-medium" : "text-[#81918E]"
                      }
                    >
                      Minimum 8 characters
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasUppercase ? (
                      <CheckCircle2 className="h-4 w-4 text-[#66C56A] shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-[#81918E] shrink-0" />
                    )}
                    <span
                      className={
                        hasUppercase ? "text-[#F5F7F6] font-medium" : "text-[#81918E]"
                      }
                    >
                      At least 1 uppercase letter
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasLowercase ? (
                      <CheckCircle2 className="h-4 w-4 text-[#66C56A] shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-[#81918E] shrink-0" />
                    )}
                    <span
                      className={
                        hasLowercase ? "text-[#F5F7F6] font-medium" : "text-[#81918E]"
                      }
                    >
                      At least 1 lowercase letter
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasNumber ? (
                      <CheckCircle2 className="h-4 w-4 text-[#66C56A] shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-[#81918E] shrink-0" />
                    )}
                    <span
                      className={
                        hasNumber ? "text-[#F5F7F6] font-medium" : "text-[#81918E]"
                      }
                    >
                      At least 1 number
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasSpecialChar ? (
                      <CheckCircle2 className="h-4 w-4 text-[#66C56A] shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-[#81918E] shrink-0" />
                    )}
                    <span
                      className={
                        hasSpecialChar
                          ? "text-[#F5F7F6] font-medium"
                          : "text-[#81918E]"
                      }
                    >
                      At least 1 special character
                    </span>
                  </div>
                </div>
              </div>

              {/* Confirm New Password Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                  Confirm New Password *
                </label>

                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-[#81918E]" />

                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirm-password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    disabled={loading}
                    className={`w-full rounded-xl border bg-[#101C1C] h-11 pl-10 pr-11 text-sm text-[#F5F7F6] placeholder:text-[#81918E] outline-none transition-all ${
                      confirmPassword && confirmPassword !== newPassword
                        ? "border-rose-500 focus:ring-1 focus:ring-rose-500"
                        : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirmation password"
                        : "Show confirmation password"
                    }
                    className="absolute right-3.5 top-3.5 text-[#81918E] hover:text-[#F5F7F6] transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-rose-400 mt-1">
                    Passwords do not match.
                  </p>
                )}
              </div>
            </CardContent>

            <CardFooter className="p-5 sm:p-6 pt-2 flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => router.push("/settings")}
                className="w-full sm:w-auto flex-1 rounded-xl border-[#203131] bg-[#101C1C] text-[#F5F7F6] hover:bg-[#132020] text-xs font-semibold h-11"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={loading || !isAllRequirementsMet || !currentPassword || !confirmPassword || newPassword !== confirmPassword}
                className="w-full sm:w-auto flex-1 rounded-xl bg-[#2E7D32] hover:bg-[#256628] disabled:opacity-50 text-white font-semibold text-xs h-11 shadow-xs flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}
    </div>
  );
}

"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  Circle,
  AlertCircle,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VehiCareLogo } from "@/components/common/VehiCareLogo";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

export default function RegisterPage() {
  useTheme(); // Synchronize active theme

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccessMessage, setIsSuccessMessage] = useState(false);
  const [loading, setLoading] = useState(false);

  // Password Requirements Evaluation
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(
    password
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
    if (!password) {
      return { score: 0, label: "", color: "bg-transparent", textColor: "" };
    }

    if (requirementsMetCount <= 1) {
      return {
        score: 1,
        label: "Weak",
        color: "bg-rose-500",
        textColor: "text-rose-600 dark:text-rose-400",
      };
    }

    if (requirementsMetCount <= 3) {
      return {
        score: 2,
        label: "Fair",
        color: "bg-amber-500",
        textColor: "text-amber-600 dark:text-amber-400",
      };
    }

    if (requirementsMetCount === 4) {
      return {
        score: 3,
        label: "Good",
        color: "bg-blue-500",
        textColor: "text-blue-600 dark:text-blue-400",
      };
    }

    return {
      score: 4,
      label: "Strong",
      color: "bg-[#2E7D32] dark:bg-[#66C56A]",
      textColor: "text-[#2E7D32] dark:text-[#66C56A]",
    };
  };

  const strength = getPasswordStrength();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    setMessage("");
    setIsSuccessMessage(false);

    if (!fullName || !email || !password) {
      setMessage("Please fill in all fields.");
      return;
    }

    if (!isAllRequirementsMet) {
      setMessage("Please ensure your password meets all security requirements.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data.user && !data.session) {
      setIsSuccessMessage(true);
      setMessage(
        "Registration successful! Please check your email to verify your account."
      );
      return;
    }

    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#071011] flex items-center justify-center px-4 py-8 transition-colors">
      <div className="w-full max-w-md">
        {/* Brand Logo */}
        <div className="text-center mb-6 flex flex-col items-center">
          <VehiCareLogo size="lg" priority withGlow className="mb-3" />

          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#F5F7F6] leading-tight">
            Create Account
          </h1>
          <span className="text-xs font-medium text-slate-500 dark:text-[#81918E] mt-0.5 block">
            by Credencer Technologies
          </span>

          <p className="mt-2 text-sm text-slate-500 dark:text-[#81918E]">
            Start tracking your vehicle maintenance with VehiCare AI
          </p>
        </div>

        {/* Register Card */}
        <Card className="border border-slate-200 dark:border-[#203131] bg-white dark:bg-[#0B1515] rounded-2xl shadow-xs dark:shadow-xl overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-[#F5F7F6]">Sign Up</CardTitle>

            <CardDescription className="text-xs text-slate-500 dark:text-[#81918E]">
              Create a free account to track your vehicle maintenance logs
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4 pt-0">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-[#B8C4C2]">
                  Full Name
                </label>

                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-[#81918E] pointer-events-none" />

                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    required
                    disabled={loading}
                    className="w-full rounded-xl border border-slate-200 dark:border-[#203131] bg-slate-50 dark:bg-[#101C1C] h-11 pl-10 pr-4 text-sm text-slate-900 dark:text-[#F5F7F6] placeholder:text-slate-400 dark:placeholder:text-[#81918E] outline-none transition-all focus:bg-white dark:focus:bg-[#101C1C] focus:border-[#2E7D32] dark:focus:border-[#66C56A] focus:ring-1 focus:ring-[#2E7D32] dark:focus:ring-[#66C56A]"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-[#B8C4C2]">
                  Email Address
                </label>

                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-[#81918E] pointer-events-none" />

                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    disabled={loading}
                    className="w-full rounded-xl border border-slate-200 dark:border-[#203131] bg-slate-50 dark:bg-[#101C1C] h-11 pl-10 pr-4 text-sm text-slate-900 dark:text-[#F5F7F6] placeholder:text-slate-400 dark:placeholder:text-[#81918E] outline-none transition-all focus:bg-white dark:focus:bg-[#101C1C] focus:border-[#2E7D32] dark:focus:border-[#66C56A] focus:ring-1 focus:ring-[#2E7D32] dark:focus:ring-[#66C56A]"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-[#B8C4C2]">
                  Password
                </label>

                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-[#81918E] pointer-events-none" />

                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter strong password"
                    required
                    disabled={loading}
                    className="w-full rounded-xl border border-slate-200 dark:border-[#203131] bg-slate-50 dark:bg-[#101C1C] h-11 pl-10 pr-11 text-sm text-slate-900 dark:text-[#F5F7F6] placeholder:text-slate-400 dark:placeholder:text-[#81918E] outline-none transition-all focus:bg-white dark:focus:bg-[#101C1C] focus:border-[#2E7D32] dark:focus:border-[#66C56A] focus:ring-1 focus:ring-[#2E7D32] dark:focus:ring-[#66C56A]"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3.5 top-3.5 text-slate-400 dark:text-[#81918E] hover:text-slate-700 dark:hover:text-[#F5F7F6] focus:outline-none focus:text-slate-700 dark:focus:text-[#F5F7F6] transition-colors z-10 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {password && (
                  <div className="pt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-[#81918E]">Password Strength:</span>
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
                              : "bg-slate-200 dark:bg-[#203131]"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Live Password Requirements Checklist */}
              <div className="rounded-xl border border-slate-200 dark:border-[#203131] bg-slate-50/70 dark:bg-[#101C1C] p-4 space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#B8C4C2]">
                  Password Requirements
                </p>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    {hasMinLength ? (
                      <CheckCircle2 className="h-4 w-4 text-[#2E7D32] dark:text-[#66C56A] shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-slate-400 dark:text-[#81918E] shrink-0" />
                    )}
                    <span
                      className={
                        hasMinLength
                          ? "text-slate-900 dark:text-[#F5F7F6] font-medium"
                          : "text-slate-500 dark:text-[#81918E]"
                      }
                    >
                      Minimum 8 characters
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasUppercase ? (
                      <CheckCircle2 className="h-4 w-4 text-[#2E7D32] dark:text-[#66C56A] shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-slate-400 dark:text-[#81918E] shrink-0" />
                    )}
                    <span
                      className={
                        hasUppercase
                          ? "text-slate-900 dark:text-[#F5F7F6] font-medium"
                          : "text-slate-500 dark:text-[#81918E]"
                      }
                    >
                      At least 1 uppercase letter
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasLowercase ? (
                      <CheckCircle2 className="h-4 w-4 text-[#2E7D32] dark:text-[#66C56A] shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-slate-400 dark:text-[#81918E] shrink-0" />
                    )}
                    <span
                      className={
                        hasLowercase
                          ? "text-slate-900 dark:text-[#F5F7F6] font-medium"
                          : "text-slate-500 dark:text-[#81918E]"
                      }
                    >
                      At least 1 lowercase letter
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasNumber ? (
                      <CheckCircle2 className="h-4 w-4 text-[#2E7D32] dark:text-[#66C56A] shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-slate-400 dark:text-[#81918E] shrink-0" />
                    )}
                    <span
                      className={
                        hasNumber
                          ? "text-slate-900 dark:text-[#F5F7F6] font-medium"
                          : "text-slate-500 dark:text-[#81918E]"
                      }
                    >
                      At least 1 number
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasSpecialChar ? (
                      <CheckCircle2 className="h-4 w-4 text-[#2E7D32] dark:text-[#66C56A] shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-slate-400 dark:text-[#81918E] shrink-0" />
                    )}
                    <span
                      className={
                        hasSpecialChar
                          ? "text-slate-900 dark:text-[#F5F7F6] font-medium"
                          : "text-slate-500 dark:text-[#81918E]"
                      }
                    >
                      At least 1 special character
                    </span>
                  </div>
                </div>
              </div>

              {message && (
                <div
                  className={`rounded-xl p-3.5 text-xs font-medium flex items-center gap-2.5 ${
                    isSuccessMessage
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300"
                      : "bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  {isSuccessMessage ? (
                    <Check className="h-4 w-4 shrink-0 text-[#2E7D32] dark:text-[#66C56A]" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" />
                  )}
                  <span>{message}</span>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-4 pt-2">
              <Button
                type="submit"
                disabled={loading || (password.length > 0 && !isAllRequirementsMet)}
                className="w-full h-11 rounded-xl bg-[#2E7D32] text-white hover:bg-[#256628] font-semibold text-sm shadow-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Creating account..." : "Sign Up"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <p className="text-center text-[11px] text-slate-500 dark:text-[#81918E] leading-relaxed">
                By creating an account, you agree to our{" "}
                <Link href="/cookie-policy" className="underline hover:text-[#2E7D32] dark:hover:text-[#66C56A]">
                  Cookie Policy
                </Link>
                . Your information is used solely to provide your vehicle management workspace.
              </p>

              <p className="text-center text-xs text-slate-500 dark:text-[#81918E]">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-[#2E7D32] dark:text-[#66C56A] hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}

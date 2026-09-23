"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, Lock, ArrowRight, AlertCircle, Check } from "lucide-react";
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
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";

export default function ResetPasswordPage() {
  const router = useRouter();
  useTheme(); // Synchronize active theme

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isRecovery, setIsRecovery] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkRecoverySession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setIsRecovery(true);
      }
    };

    checkRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    setMessage("");
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage(
      "Password reset link has been sent to your email. Please check your inbox."
    );
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Password successfully updated. Redirecting to dashboard...");

    setTimeout(() => {
      router.push("/dashboard");
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#071011] flex items-center justify-center px-4 py-8 transition-colors">
      <div className="w-full max-w-md">
        {/* Brand Logo */}
        <div className="mb-6 flex flex-col items-center text-center">
          <VehiCareLogo size="lg" priority withGlow className="mb-3" />

          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#F5F7F6] leading-tight">
            {isRecovery ? "Set New Password" : "Reset Password"}
          </h1>
          <span className="text-xs font-medium text-slate-500 dark:text-[#81918E] mt-0.5 block">
            by Credencer Technologies
          </span>

          <p className="mt-2 text-sm text-slate-500 dark:text-[#81918E]">
            {isRecovery
              ? "Enter your new password below"
              : "Enter your email to receive a password reset link"}
          </p>
        </div>

        {/* Card */}
        <Card className="border border-slate-200 dark:border-[#203131] bg-white dark:bg-[#0B1515] rounded-2xl shadow-xs dark:shadow-xl overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-[#F5F7F6]">
              {isRecovery ? "New Password" : "Password Recovery"}
            </CardTitle>

            <CardDescription className="text-xs text-slate-500 dark:text-[#81918E]">
              {isRecovery
                ? "Please create a strong password with at least 6 characters"
                : "We will send recovery instructions to your email"}
            </CardDescription>
          </CardHeader>

          {!isRecovery ? (
            <form onSubmit={handleResetRequest}>
              <CardContent className="space-y-4 pt-0">
                {/* Email Input */}
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

                {message && (
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-2.5">
                    <Check className="h-4 w-4 shrink-0 text-[#2E7D32] dark:text-[#66C56A]" />
                    <span>{message}</span>
                  </div>
                )}

                {error && (
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-3.5 text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" />
                    <span>{error}</span>
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex flex-col gap-4 pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl bg-[#2E7D32] text-white hover:bg-[#256628] font-semibold text-sm shadow-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Sending link..." : "Send Reset Link"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <p className="text-center text-xs text-slate-500 dark:text-[#81918E]">
                  Remember your password?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-[#2E7D32] dark:text-[#66C56A] hover:underline"
                  >
                    Back to login
                  </Link>
                </p>
              </CardFooter>
            </form>
          ) : (
            <form onSubmit={handleUpdatePassword}>
              <CardContent className="space-y-4 pt-0">
                {/* New Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-[#B8C4C2]">
                    New Password
                  </label>

                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-[#81918E] pointer-events-none" />

                    <input
                      type="password"
                      name="new-password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      required
                      disabled={loading}
                      className="w-full rounded-xl border border-slate-200 dark:border-[#203131] bg-slate-50 dark:bg-[#101C1C] h-11 pl-10 pr-4 text-sm text-slate-900 dark:text-[#F5F7F6] placeholder:text-slate-400 dark:placeholder:text-[#81918E] outline-none transition-all focus:bg-white dark:focus:bg-[#101C1C] focus:border-[#2E7D32] dark:focus:border-[#66C56A] focus:ring-1 focus:ring-[#2E7D32] dark:focus:ring-[#66C56A]"
                    />
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-[#B8C4C2]">
                    Confirm Password
                  </label>

                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-[#81918E] pointer-events-none" />

                    <input
                      type="password"
                      name="confirm-password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      required
                      disabled={loading}
                      className="w-full rounded-xl border border-slate-200 dark:border-[#203131] bg-slate-50 dark:bg-[#101C1C] h-11 pl-10 pr-4 text-sm text-slate-900 dark:text-[#F5F7F6] placeholder:text-slate-400 dark:placeholder:text-[#81918E] outline-none transition-all focus:bg-white dark:focus:bg-[#101C1C] focus:border-[#2E7D32] dark:focus:border-[#66C56A] focus:ring-1 focus:ring-[#2E7D32] dark:focus:ring-[#66C56A]"
                    />
                  </div>
                </div>

                {message && (
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-2.5">
                    <Check className="h-4 w-4 shrink-0 text-[#2E7D32] dark:text-[#66C56A]" />
                    <span>{message}</span>
                  </div>
                )}

                {error && (
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-3.5 text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" />
                    <span>{error}</span>
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex flex-col gap-4 pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl bg-[#2E7D32] text-white hover:bg-[#256628] font-semibold text-sm shadow-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Updating..." : "Update Password"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <p className="text-center text-xs text-slate-500 dark:text-[#81918E]">
                  Remember your password?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-[#2E7D32] dark:text-[#66C56A] hover:underline"
                  >
                    Back to login
                  </Link>
                </p>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
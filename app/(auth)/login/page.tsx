"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, Lock, ArrowRight, Eye, EyeOff, AlertCircle } from "lucide-react";
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
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";
import { VehiCareLogo } from "@/components/common/VehiCareLogo";

export default function LoginPage() {
  const router = useRouter();
  useTheme(); // Synchronize active theme

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#071011] flex items-center justify-center px-4 py-8 transition-colors">
      <div className="w-full max-w-md">
        {/* Brand Logo */}
        <div className="mb-6 flex flex-col items-center text-center">
          <VehiCareLogo size="lg" priority withGlow className="mb-3" />

          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#F5F7F6] leading-tight">
            Welcome to VehiCare AI
          </h1>
          <span className="text-xs font-medium text-slate-500 dark:text-[#81918E] mt-0.5 block">
            by Credencer Technologies
          </span>

          <p className="mt-2 text-sm text-slate-500 dark:text-[#81918E]">
            Smart vehicle maintenance & fleet logging
          </p>
        </div>

        {/* Login Card */}
        <Card className="border border-slate-200 dark:border-[#203131] bg-white dark:bg-[#0B1515] rounded-2xl shadow-xs dark:shadow-xl overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-[#F5F7F6]">Sign In</CardTitle>

            <CardDescription className="text-xs text-slate-500 dark:text-[#81918E]">
              Enter your email and password to access your dashboard
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 pt-0">
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
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-[#B8C4C2]">
                    Password
                  </label>

                  <Link
                    href="/reset-password"
                    className="text-xs text-[#2E7D32] dark:text-[#66C56A] hover:underline font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>

                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-[#81918E] pointer-events-none" />

                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    className="w-full rounded-xl border border-slate-200 dark:border-[#203131] bg-slate-50 dark:bg-[#101C1C] h-11 pl-10 pr-11 text-sm text-slate-900 dark:text-[#F5F7F6] placeholder:text-slate-400 dark:placeholder:text-[#81918E] outline-none transition-all focus:bg-white dark:focus:bg-[#101C1C] focus:border-[#2E7D32] dark:focus:border-[#66C56A] focus:ring-1 focus:ring-[#2E7D32] dark:focus:ring-[#66C56A]"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3.5 top-3.5 text-slate-400 dark:text-[#81918E] hover:text-slate-700 dark:hover:text-[#F5F7F6] focus:outline-none focus:text-slate-700 dark:focus:text-[#F5F7F6] transition-colors z-10 cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

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
                {loading ? "Signing in..." : "Sign In"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <p className="text-center text-xs text-slate-500 dark:text-[#81918E]">
                Don&apos;t have an account?{" "}
                <Link
                  href="/register"
                  className="font-semibold text-[#2E7D32] dark:text-[#66C56A] hover:underline"
                >
                  Sign up
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { SplashScreen } from "@/components/common/SplashScreen";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function SplashPage() {
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);

  return (
    <div className="min-h-screen bg-[#071011] flex flex-col items-center justify-center p-4">
      {showSplash ? (
        <SplashScreen
          duration={2200}
          onFinish={() => setShowSplash(false)}
        />
      ) : (
        <div className="text-center space-y-4">
          <p className="text-sm text-[#81918E]">Splash animation completed.</p>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => setShowSplash(true)}
              className="bg-[#2E7D32] hover:bg-[#256628] text-white"
            >
              Replay Splash
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard")}
              className="border-[#203131] bg-[#101C1C] text-[#F5F7F6]"
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

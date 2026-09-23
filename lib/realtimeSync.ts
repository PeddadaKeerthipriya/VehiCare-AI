"use client";

import { supabase } from "./supabase";
import { invalidateApiCache } from "./api";
import { invalidateRemindersCache } from "./reminders";

export type SyncEventType = "document" | "vehicle" | "maintenance";
export type DocumentSyncType = "insurance" | "puc" | "fastag" | "rc";

export interface SyncPayload {
  type: SyncEventType;
  vehicleId?: string;
  documentType?: DocumentSyncType;
  timestamp: number;
}

export type SyncCallback = (payload: SyncPayload) => void;

function handleSyncCacheInvalidation(payload: SyncPayload) {
  if (payload.type === "document") {
    if (payload.documentType) {
      invalidateApiCache(`/${payload.documentType}`);
    } else {
      invalidateApiCache("/insurance");
      invalidateApiCache("/puc");
      invalidateApiCache("/fastag");
    }
    if (payload.vehicleId) {
      invalidateApiCache(`/vehicles/${encodeURIComponent(payload.vehicleId)}`);
    }
    invalidateRemindersCache();
  } else if (payload.type === "vehicle") {
    invalidateApiCache("/vehicles");
    invalidateRemindersCache();
  } else if (payload.type === "maintenance") {
    invalidateApiCache("/services");
    invalidateApiCache("/maintenance-schedules");
    invalidateRemindersCache();
  } else {
    invalidateApiCache();
    invalidateRemindersCache();
  }
}

const SYNC_EVENT_NAME = "vehicare:sync_event";
const BROADCAST_CHANNEL_NAME = "vehicare_realtime_sync_channel";
const SUPABASE_CHANNEL_NAME = "vehicare_global_sync";

let broadcastChannel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    return null;
  }
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    } catch (e) {
      console.warn("[RealtimeSync] BroadcastChannel initialization failed:", e);
    }
  }
  return broadcastChannel;
}

let globalSupabaseChannel: ReturnType<typeof supabase.channel> | null = null;

function getGlobalSupabaseChannel() {
  if (!globalSupabaseChannel) {
    globalSupabaseChannel = supabase.channel(SUPABASE_CHANNEL_NAME, {
      config: { broadcast: { ack: false } },
    });
    globalSupabaseChannel.subscribe((status) => {
      if (process.env.NODE_ENV === "development") {
        console.log(`[RealtimeSync] Global Supabase channel status: ${status}`);
      }
    });
  }
  return globalSupabaseChannel;
}

/**
 * Emit a synchronization event to all components in the current tab,
 * other tabs via BroadcastChannel, and other clients via Supabase Broadcast.
 */
export function emitSyncEvent(event: Omit<SyncPayload, "timestamp">): void {
  const payload: SyncPayload = {
    ...event,
    timestamp: Date.now(),
  };

  // Synchronously invalidate matching API and reminders caches immediately
  handleSyncCacheInvalidation(payload);

  // 1. Same-tab: Dispatch CustomEvent
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent<SyncPayload>(SYNC_EVENT_NAME, { detail: payload })
      );
    } catch (e) {
      console.error("[RealtimeSync] CustomEvent dispatch failed:", e);
    }
  }

  // 2. Cross-tab: Dispatch via native HTML5 BroadcastChannel
  const bc = getBroadcastChannel();
  if (bc) {
    try {
      bc.postMessage(payload);
    } catch (e) {
      console.error("[RealtimeSync] BroadcastChannel post failed:", e);
    }
  }

  // 3. Supabase Realtime Broadcast (over WebSocket across tabs)
  try {
    const channel = getGlobalSupabaseChannel();
    channel.send({
      type: "broadcast",
      event: "sync_event",
      payload,
    });
  } catch (e) {
    console.warn("[RealtimeSync] Supabase broadcast send failed:", e);
  }
}

export function emitDocumentUpdate(vehicleId: string, documentType: DocumentSyncType = "insurance") {
  emitSyncEvent({ type: "document", vehicleId, documentType });
}

export function emitVehicleUpdate(vehicleId?: string) {
  emitSyncEvent({ type: "vehicle", vehicleId });
}

export function emitMaintenanceUpdate(vehicleId?: string) {
  emitSyncEvent({ type: "maintenance", vehicleId });
}

/**
 * Subscribe a component to sync events across all 3 layers.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeToSyncEvents(callback: SyncCallback): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  // 1. Listen for same-tab CustomEvents
  const handleCustomEvent = (e: Event) => {
    const customEvent = e as CustomEvent<SyncPayload>;
    if (customEvent.detail) {
      handleSyncCacheInvalidation(customEvent.detail);
      callback(customEvent.detail);
    }
  };
  window.addEventListener(SYNC_EVENT_NAME, handleCustomEvent);

  // 2. Listen for cross-tab BroadcastChannel messages
  const bc = getBroadcastChannel();
  const handleBroadcastMessage = (e: MessageEvent) => {
    if (e.data && e.data.type) {
      handleSyncCacheInvalidation(e.data as SyncPayload);
      callback(e.data as SyncPayload);
    }
  };
  if (bc) {
    bc.addEventListener("message", handleBroadcastMessage);
  }

  // 3. Listen for Supabase Realtime WebSocket broadcast
  const channel = getGlobalSupabaseChannel();
  channel.on(
    "broadcast",
    { event: "sync_event" },
    ({ payload }) => {
      if (payload) {
        handleSyncCacheInvalidation(payload as SyncPayload);
        callback(payload as SyncPayload);
      }
    }
  );

  // Return cleanup function
  return () => {
    window.removeEventListener(SYNC_EVENT_NAME, handleCustomEvent);
    if (bc) {
      bc.removeEventListener("message", handleBroadcastMessage);
    }
  };
}

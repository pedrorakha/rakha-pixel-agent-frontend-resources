"use client";

import { useEffect, useRef } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE";

interface RealtimePayload<T> {
  eventType: RealtimeEvent;
  new: T;
  old: Partial<T>;
}

interface UseSupabaseRealtimeOptions<T> {
  table: string;
  schema?: string;
  event?: RealtimeEvent | "*";
  filter?: string;
  onInsert?: (record: T) => void;
  onUpdate?: (record: T, old: Partial<T>) => void;
  onDelete?: (old: Partial<T>) => void;
  enabled?: boolean;
}

export function useSupabaseRealtime<T extends Record<string, unknown>>(
  options: UseSupabaseRealtimeOptions<T>
) {
  const {
    table,
    schema = "public",
    event = "*",
    filter,
    onInsert,
    onUpdate,
    onDelete,
    enabled = true,
  } = options;

  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();

    const channelName = `realtime:${schema}:${table}:${filter ?? "all"}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as never,
        {
          event,
          schema,
          table,
          filter,
        } as never,
        (payload: RealtimePayload<T>) => {
          switch (payload.eventType) {
            case "INSERT":
              onInsert?.(payload.new);
              break;
            case "UPDATE":
              onUpdate?.(payload.new, payload.old);
              break;
            case "DELETE":
              onDelete?.(payload.old);
              break;
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, schema, event, filter, onInsert, onUpdate, onDelete, enabled]);
}

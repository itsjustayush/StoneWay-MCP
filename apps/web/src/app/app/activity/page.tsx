"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Shield,
  Key,
  RefreshCw,
  Clock,
  Activity,
  FileEdit,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from "lucide-react";

interface AuditEventItem {
  id: string;
  event: string;
  agentLabel: string;
  ipHash: string | null;
  requestId: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

export default function ActivityLogPage() {
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const fetchActivity = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/activity");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
  }, []);

  const formatEventTitle = (event: AuditEventItem) => {
    const timeStr = new Date(event.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const clientStr = event.ipHash ? `client [${event.ipHash.slice(0, 8)}]` : "client";

    switch (event.event) {
      case "key.reveal":
        return `API token revealed in web dashboard at ${timeStr}`;
      case "key.regenerate":
        return `Unified Agent Key regenerated from ${clientStr} at ${timeStr}`;
      case "key.revoke":
        return `API key revoked at ${timeStr}`;
      case "profile.write":
        return `${event.agentLabel || "Agent"} updated profile context (v${event.metadata?.version || "?"}) at ${timeStr}`;
      case "sync.trigger":
        return `External sync started for ${event.metadata?.integration || "connectors"} at ${timeStr}`;
      case "sync.complete":
        return `GitHub sync finished (${event.metadata?.projects_synced || 0} repositories synced) at ${timeStr}`;
      case "sync.error":
        return `Sync error encountered: ${event.metadata?.error || "Unknown"} at ${timeStr}`;
      case "auth.failure":
        return `⚠️ Unauthorized key attempt detected from ${clientStr} at ${timeStr}`;
      default:
        return `${event.event} recorded from ${event.agentLabel} at ${timeStr}`;
    }
  };

  const getEventBadge = (eventName: string) => {
    if (eventName.startsWith("key.")) {
      return (
        <span className="flex items-center gap-1 text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800 text-blue-300">
          <Key className="w-2.5 h-2.5" /> Key
        </span>
      );
    }
    if (eventName.startsWith("profile.")) {
      return (
        <span className="flex items-center gap-1 text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-green-950/60 border border-green-800 text-green-300">
          <FileEdit className="w-2.5 h-2.5" /> Memory
        </span>
      );
    }
    if (eventName.startsWith("sync.")) {
      return (
        <span className="flex items-center gap-1 text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800 text-purple-300">
          <RefreshCw className="w-2.5 h-2.5" /> Sync
        </span>
      );
    }
    if (eventName.startsWith("auth.failure")) {
      return (
        <span className="flex items-center gap-1 text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-red-950/60 border border-red-800 text-red-300">
          <AlertTriangle className="w-2.5 h-2.5" /> Security
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
        <Activity className="w-2.5 h-2.5" /> Event
      </span>
    );
  };

  const filteredEvents = events.filter((e) => {
    if (filter === "all") return true;
    if (filter === "keys") return e.event.startsWith("key.");
    if (filter === "memory") return e.event.startsWith("profile.");
    if (filter === "sync") return e.event.startsWith("sync.");
    if (filter === "security") return e.event.startsWith("auth.");
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Navigation tabs */}
      <div className="flex items-center justify-between border-b border-neutral-900 pb-3 text-xs">
        <div className="flex items-center space-x-6">
          <Link href="/app/editor" className="text-neutral-500 hover:text-white transition">
            editor (/app/editor)
          </Link>
          <Link href="/app/key" className="text-neutral-500 hover:text-white transition">
            api key hub (/app/key)
          </Link>
          <Link href="/app/connectors" className="text-neutral-500 hover:text-white transition">
            connectors (/app/connectors)
          </Link>
          <span className="font-bold text-white border-b-2 border-white pb-3 -mb-3.5">
            activity (/app/activity)
          </span>
        </div>
        <button
          onClick={fetchActivity}
          disabled={loading}
          className="flex items-center gap-1 text-neutral-400 hover:text-white text-[11px] transition"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          <span>refresh</span>
        </button>
      </div>

      {/* Header Info */}
      <div className="bg-neutral-950 p-5 border border-neutral-900 rounded-lg space-y-2">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Zero-Leak Audit Timeline
          </h2>
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed">
          StoneWay records an append-only audit trail for all key accesses, profile mutations, and sync executions.
          In strict compliance with our privacy guarantee, raw tokens, request bodies, and markdown contents are
          cryptographically filtered and never written to logs.
        </p>

        {/* Filter Chips */}
        <div className="flex flex-wrap gap-2 pt-2">
          {[
            { id: "all", label: "All Activity" },
            { id: "keys", label: "Key Access" },
            { id: "memory", label: "Memory Writes" },
            { id: "sync", label: "Sync Operations" },
            { id: "security", label: "Security & Failures" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1 rounded text-xs transition ${
                filter === f.id
                  ? "bg-white text-black font-semibold"
                  : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Timeline List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-xs text-neutral-500 py-12 text-center">Loading audit events...</div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-xs text-neutral-500 py-12 text-center border border-dashed border-neutral-900 rounded-lg">
            No audit events found for this filter.
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className="bg-neutral-950 border border-neutral-900 hover:border-neutral-800 transition p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {getEventBadge(event.event)}
                  <span className="font-semibold text-neutral-200">{formatEventTitle(event)}</span>
                </div>
                <div className="text-[11px] text-neutral-500 flex items-center gap-3">
                  <span>Agent: <code className="text-neutral-400">{event.agentLabel}</code></span>
                  {event.ipHash && (
                    <span>Client Hash: <code className="text-neutral-400 font-mono">#{event.ipHash.slice(0, 8)}</code></span>
                  )}
                  {event.requestId && (
                    <span>Req: <code className="text-neutral-500 font-mono">{event.requestId}</code></span>
                  )}
                </div>
              </div>

              <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 shrink-0">
                <Clock className="w-3 h-3 text-neutral-600" />
                <time dateTime={event.createdAt}>
                  {new Date(event.createdAt).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  {new Date(event.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

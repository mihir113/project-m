"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface LogEntry {
  id: string;
  prompt: string;
  success: boolean;
  operationsCount: number;
  successCount: number;
  errorCount: number;
  operations: Array<{
    tool: string;
    status: "success" | "error";
    result?: any;
    error?: string;
  }>;
  executionTimeMs: number | null;
  createdAt: string;
}

export default function AILogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/ai-logs");
      const data = await res.json();
      setLogs(data.data || []);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-secondary text-sm">Loading logs...</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">AI Execution Logs</h1>
          <p className="text-secondary text-sm mt-1">
            View all AI agent executions and their results
          </p>
        </div>
        <Link href="/ai" className="btn-primary">
          ← Back to AI Assistant
        </Link>
      </div>

      {logs.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-muted text-sm">No execution logs yet.</p>
          <p className="text-muted text-xs mt-1">
            Logs will appear here after using the AI assistant.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Logs List */}
          <div className="space-y-3">
            {logs.map((log) => (
              <button
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className={`w-full text-left p-4 rounded-lg transition-colors ${
                  selectedLog?.id === log.id
                    ? "bg-[#4f6ff5]/10 border-2 border-[#4f6ff5]"
                    : "card hover:bg-elevated border-2 border-transparent"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        log.success ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                    <span className="text-xs text-muted">
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                  {log.executionTimeMs && (
                    <span className="text-xs text-muted">
                      {log.executionTimeMs}ms
                    </span>
                  )}
                </div>

                <p className="text-sm text-primary font-medium mb-2 line-clamp-2">
                  {log.prompt}
                </p>

                <div className="flex items-center gap-4 text-xs">
                  <span className="text-secondary">
                    {log.operationsCount} operation{log.operationsCount !== 1 ? "s" : ""}
                  </span>
                  {log.successCount > 0 && (
                    <span className="text-green-400">
                      ✓ {log.successCount}
                    </span>
                  )}
                  {log.errorCount > 0 && (
                    <span className="text-red-400">
                      ✗ {log.errorCount}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Log Details */}
          <div className="lg:sticky lg:top-6 h-fit">
            {selectedLog ? (
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      selectedLog.success ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <h2 className="text-base font-semibold text-primary">
                    Execution Details
                  </h2>
                </div>

                {/* Prompt */}
                <div className="mb-4 pb-4 border-b border-default">
                  <p className="text-xs text-muted mb-1">Prompt</p>
                  <p className="text-sm text-secondary">{selectedLog.prompt}</p>
                </div>

                {/* Metadata */}
                <div className="mb-4 pb-4 border-b border-default">
                  <p className="text-xs text-muted mb-2">Metadata</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted">Time:</span>{" "}
                      <span className="text-secondary">
                        {formatDate(selectedLog.createdAt)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted">Duration:</span>{" "}
                      <span className="text-secondary">
                        {selectedLog.executionTimeMs}ms
                      </span>
                    </div>
                    <div>
                      <span className="text-muted">Operations:</span>{" "}
                      <span className="text-secondary">
                        {selectedLog.operationsCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted">Success:</span>{" "}
                      <span
                        className={
                          selectedLog.success ? "text-green-400" : "text-red-400"
                        }
                      >
                        {selectedLog.success ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Operations */}
                <div>
                  <p className="text-xs text-muted mb-2">Operations</p>
                  <div className="space-y-2">
                    {selectedLog.operations.map((op, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-tertiary border-l-4"
                        style={{
                          borderLeftColor:
                            op.status === "success" ? "#10b981" : "#ef4444",
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-primary">
                            {op.tool}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              op.status === "success"
                                ? "bg-green-500/20 text-green-400"
                                : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {op.status}
                          </span>
                        </div>

                        {op.error && (
                          <p className="text-xs text-red-400 mt-1">{op.error}</p>
                        )}

                        {op.result && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted cursor-pointer hover:text-secondary">
                              View result
                            </summary>
                            <pre className="mt-2 p-2 rounded bg-secondary text-xs text-primary overflow-x-auto max-h-48">
                              {JSON.stringify(op.result, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card p-12 text-center">
                <p className="text-muted text-sm">
                  Select a log to view details
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

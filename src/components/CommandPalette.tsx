"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { useAIAgent } from "@/hooks/useAIAgent";

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [command, setCommand] = useState("");
  const [previewPlan, setPreviewPlan] = useState<any>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const { showToast } = useToast();

  const { preview, executeConfirmed, loading } = useAIAgent({
    onPreview: (data) => {
      setPreviewPlan(data);
      setShowConfirmation(true);
    },
    onSuccess: (data) => {
      setExecutionResult(data);
      setShowConfirmation(false);
      showToast(data.message, "success");
      setCommand("");
      // Auto-close after showing results for 3 seconds
      setTimeout(() => {
        setExecutionResult(null);
        setIsOpen(false);
      }, 3000);
    },
    onError: (error) => {
      showToast(error.message, "error");
      setShowConfirmation(false);
    },
  });

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      // ESC to close
      if (e.key === "Escape") {
        setIsOpen(false);
        setShowConfirmation(false);
        setExecutionResult(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || loading) return;
    await preview(command.trim());
  };

  const handleConfirm = async () => {
    if (previewPlan) {
      await executeConfirmed(command, previewPlan.plan);
    }
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setPreviewPlan(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    setShowConfirmation(false);
    setExecutionResult(null);
    setCommand("");
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg transition-all hover:scale-110 hover:shadow-xl flex items-center justify-center group z-50"
        style={{ backgroundColor: "#4f6ff5" }}
        title="Open AI Command Palette (⌘K)"
      >
        <svg
          className="w-6 h-6 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
          <span className="text-white text-xs font-bold">AI</span>
        </span>
      </button>

      {/* Command Input Modal */}
      <Modal open={isOpen && !showConfirmation && !executionResult} onClose={handleClose} title="AI Command Palette">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-muted mb-2 block">
              What would you like to do?
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g., Create a project called 'Q1 Planning'"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              autoFocus
              disabled={loading}
            />
            <p className="text-xs text-muted mt-2">
              Press <kbd className="px-1 py-0.5 bg-tertiary rounded text-xs">⌘K</kbd> or{" "}
              <kbd className="px-1 py-0.5 bg-tertiary rounded text-xs">Ctrl+K</kbd> to toggle
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={handleClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!command.trim() || loading}
            >
              {loading ? "Processing..." : "Execute"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        open={showConfirmation}
        onClose={handleCancel}
        title="Confirm AI Operations"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            The AI will execute the following operations:
          </p>

          {previewPlan?.operations && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {previewPlan.operations.map((op: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-tertiary border-l-4 border-[#4f6ff5]"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-[#4f6ff5] text-white text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-medium text-primary">
                      {op.tool}
                    </span>
                  </div>
                  <p className="text-xs text-secondary ml-7">{op.description}</p>

                  <details className="mt-2 ml-7">
                    <summary className="text-xs text-muted cursor-pointer hover:text-secondary">
                      View details
                    </summary>
                    <pre className="mt-2 p-2 rounded bg-secondary text-xs text-primary overflow-x-auto">
                      {JSON.stringify(op.arguments, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-default">
            <button className="btn-ghost" onClick={handleCancel}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? "Executing..." : "✓ Confirm & Execute"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Execution Results Modal */}
      <Modal
        open={!!executionResult}
        onClose={() => setExecutionResult(null)}
        title={executionResult?.success ? "✓ Success" : "✗ Failed"}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                executionResult?.success ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <p className="text-sm text-primary font-medium">
              {executionResult?.message}
            </p>
          </div>

          {executionResult?.operations && executionResult.operations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted">Operations executed:</p>
              {executionResult.operations.map((op: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-tertiary border-l-4"
                  style={{
                    borderLeftColor: op.status === "success" ? "#10b981" : "#ef4444",
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
                      <pre className="mt-2 p-2 rounded bg-secondary text-xs text-primary overflow-x-auto max-h-32">
                        {JSON.stringify(op.result, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <button
              className="btn-primary"
              onClick={() => setExecutionResult(null)}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

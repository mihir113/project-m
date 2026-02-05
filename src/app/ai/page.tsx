"use client";

import { useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";

interface Operation {
  tool: string;
  status: "success" | "error";
  result?: any;
  error?: string;
}

interface AgentResponse {
  success: boolean;
  message: string;
  operations: Operation[];
}

export default function AIPage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [previewPlan, setPreviewPlan] = useState<any>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent, skipPreview = false) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch("/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          preview: !skipPreview,
          confirmedPlan: skipPreview ? previewPlan?.plan : undefined,
        }),
      });

      const data = await res.json();

      // If this is a preview, show confirmation dialog
      if (data.preview) {
        setPreviewPlan(data);
        setShowConfirmation(true);
        showToast("Review the planned operations", "success");
      } else {
        // Execution completed
        setResponse(data);
        setPreviewPlan(null);
        setShowConfirmation(false);

        if (data.success) {
          showToast(data.message, "success");
        } else {
          const errorMsg = data.error
            ? `${data.message}: ${data.error}`
            : data.message || "Operation failed";
          showToast(errorMsg, "error");
        }
      }
    } catch (error: any) {
      const errorMsg = error.message || "Failed to process AI request";
      showToast(errorMsg, "error");
      setResponse({
        success: false,
        message: `Network error: ${errorMsg}`,
        operations: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setShowConfirmation(false);
    // Create a synthetic event to reuse handleSubmit
    const syntheticEvent = { preventDefault: () => {} } as React.FormEvent;
    await handleSubmit(syntheticEvent, true);
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setPreviewPlan(null);
    showToast("Operation cancelled", "success");
  };

  const examplePrompts = [
    "Create a template called 'Weekly Sync' with description 'Weekly team sync template'",
    "Create a project called 'Q1 Planning' and add a one-time requirement 'Review goals' due tomorrow",
    "Get all team members",
    "Create project SR Quality review and assign it to me and then look at team with role direct and then create requirement for each one of them in that project",
  ];

  return (
    <div className="animate-fadeIn max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">AI Assistant</h1>
          <p className="text-secondary text-sm mt-1">
            Natural language database operations powered by Groq
          </p>
        </div>
        <Link href="/ai-logs" className="text-sm text-[#4f6ff5] hover:underline">
          View Execution Logs →
        </Link>
      </div>

      {/* Input Form */}
      <div className="card p-6 mb-6">
        <form onSubmit={handleSubmit}>
          <label className="text-xs text-muted mb-2 block">
            What would you like to do?
          </label>
          <textarea
            className="input-field mb-4"
            rows={4}
            placeholder="e.g., Create a quarterly review template, make a project called 'Q1 Goals', and assign it to Mihir"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading || !prompt.trim()}
          >
            {loading ? "Processing..." : "Execute"}
          </button>
        </form>
      </div>

      {/* Example Prompts */}
      <div className="card p-4 mb-6">
        <h2 className="text-sm font-semibold text-primary mb-3">Example Commands</h2>
        <div className="space-y-2">
          {examplePrompts.map((example, idx) => (
            <button
              key={idx}
              onClick={() => setPrompt(example)}
              className="w-full text-left p-3 rounded-lg bg-tertiary hover:bg-elevated transition-colors text-xs text-secondary"
              disabled={loading}
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Response Display */}
      {response && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div
              className={`w-3 h-3 rounded-full ${
                response.success ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <h2 className="text-sm font-semibold text-primary">
              {response.message}
            </h2>
          </div>

          {response.operations.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-muted mb-2">Operations:</p>
              {response.operations.map((op, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-tertiary border-l-4"
                  style={{
                    borderLeftColor: op.status === "success" ? "#10b981" : "#ef4444",
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
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
                      <pre className="mt-2 p-2 rounded bg-secondary text-xs text-primary overflow-x-auto">
                        {JSON.stringify(op.result, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        open={showConfirmation}
        onClose={handleCancel}
        title="Confirm Operations"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            The AI agent plans to execute the following operations:
          </p>

          {previewPlan?.operations && (
            <div className="space-y-2">
              {previewPlan.operations.map((op: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-tertiary border-l-4 border-[#4f6ff5]"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-primary">
                      {idx + 1}. {op.tool}
                    </span>
                  </div>
                  <p className="text-xs text-secondary">{op.description}</p>

                  {/* Show arguments */}
                  <details className="mt-2">
                    <summary className="text-xs text-muted cursor-pointer hover:text-secondary">
                      View parameters
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
              {loading ? "Executing..." : "Confirm & Execute"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Documentation */}
      <div className="card p-6 mt-6">
        <h2 className="text-sm font-semibold text-primary mb-3">
          Available Operations
        </h2>
        <ul className="space-y-2 text-xs text-secondary">
          <li className="flex items-start gap-2">
            <span className="text-[#4f6ff5] mt-0.5">•</span>
            <div>
              <strong className="text-primary">Get team members:</strong> Query
              all team members in the database
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#4f6ff5] mt-0.5">•</span>
            <div>
              <strong className="text-primary">Create template:</strong> Create
              check-in templates with goal areas and goals
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#4f6ff5] mt-0.5">•</span>
            <div>
              <strong className="text-primary">Create project:</strong> Create new
              projects with optional category and color
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#4f6ff5] mt-0.5">•</span>
            <div>
              <strong className="text-primary">Create requirement:</strong> Add
              one-time or recurring tasks to projects
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}

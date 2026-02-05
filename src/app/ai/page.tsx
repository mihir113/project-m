"use client";

import { useState, useEffect } from "react";
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

interface SavedCommand {
  id: string;
  label: string;
  command: string;
}

export default function AIPage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [previewPlan, setPreviewPlan] = useState<any>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [savedCommands, setSavedCommands] = useState<SavedCommand[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [editingCommand, setEditingCommand] = useState<SavedCommand | null>(null);
  const { showToast } = useToast();

  // Load saved commands from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("ai-quick-commands");
    if (saved) {
      try {
        setSavedCommands(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved commands", e);
      }
    } else {
      // Set default commands if none exist
      const defaults: SavedCommand[] = [
        {
          id: "1",
          label: "Create Weekly Sync Template",
          command: "Create a template called 'Weekly Sync' with description 'Weekly team sync template'",
        },
        {
          id: "2",
          label: "Get Team Members",
          command: "Get all team members",
        },
        {
          id: "3",
          label: "SR Quality Review for Directs",
          command: "Create project SR Quality review and assign it to me and then look at team with role direct and then create requirement for each one of them in that project",
        },
      ];
      setSavedCommands(defaults);
      localStorage.setItem("ai-quick-commands", JSON.stringify(defaults));
    }
  }, []);

  // Save commands to localStorage whenever they change
  useEffect(() => {
    if (savedCommands.length > 0) {
      localStorage.setItem("ai-quick-commands", JSON.stringify(savedCommands));
    }
  }, [savedCommands]);

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

  const handleSaveCommand = () => {
    if (!saveLabel.trim() || !prompt.trim()) return;

    if (editingCommand) {
      // Update existing command
      setSavedCommands(prev =>
        prev.map(cmd =>
          cmd.id === editingCommand.id
            ? { ...cmd, label: saveLabel.trim(), command: prompt.trim() }
            : cmd
        )
      );
      showToast("Command updated", "success");
    } else {
      // Add new command
      const newCommand: SavedCommand = {
        id: Date.now().toString(),
        label: saveLabel.trim(),
        command: prompt.trim(),
      };
      setSavedCommands(prev => [...prev, newCommand]);
      showToast("Command saved", "success");
    }

    setShowSaveModal(false);
    setSaveLabel("");
    setEditingCommand(null);
  };

  const handleEditCommand = (cmd: SavedCommand) => {
    setEditingCommand(cmd);
    setPrompt(cmd.command);
    setSaveLabel(cmd.label);
    setShowSaveModal(true);
  };

  const handleDeleteCommand = (id: string) => {
    setSavedCommands(prev => prev.filter(cmd => cmd.id !== id));
    showToast("Command deleted", "success");
  };


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
          <div className="flex gap-2">
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={loading || !prompt.trim()}
            >
              {loading ? "Processing..." : "Execute"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (prompt.trim()) {
                  setSaveLabel("");
                  setEditingCommand(null);
                  setShowSaveModal(true);
                } else {
                  showToast("Enter a command first", "error");
                }
              }}
              className="btn-ghost"
              disabled={loading || !prompt.trim()}
              title="Save as quick command"
            >
              <span className="text-base">★</span>
            </button>
          </div>
        </form>
      </div>

      {/* Quick Commands */}
      <div className="card p-4 mb-6">
        <h2 className="text-sm font-semibold text-primary mb-3">Quick Commands</h2>
        {savedCommands.length === 0 ? (
          <p className="text-xs text-muted text-center py-4">
            No saved commands yet. Click ★ to save your current command.
          </p>
        ) : (
          <div className="space-y-2">
            {savedCommands.map((cmd) => (
              <div
                key={cmd.id}
                className="flex items-center gap-2 p-3 rounded-lg bg-tertiary group"
              >
                <button
                  onClick={() => setPrompt(cmd.command)}
                  className="flex-1 text-left hover:text-primary transition-colors"
                  disabled={loading}
                >
                  <p className="text-xs font-medium text-primary">{cmd.label}</p>
                  <p className="text-xs text-muted mt-0.5 line-clamp-1">{cmd.command}</p>
                </button>
                <button
                  onClick={() => handleEditCommand(cmd)}
                  className="opacity-0 group-hover:opacity-100 text-xs text-secondary hover:text-primary transition-opacity"
                  title="Edit"
                  disabled={loading}
                >
                  ✎
                </button>
                <button
                  onClick={() => handleDeleteCommand(cmd.id)}
                  className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 transition-opacity"
                  title="Delete"
                  disabled={loading}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
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

      {/* Save Command Modal */}
      <Modal
        open={showSaveModal}
        onClose={() => {
          setShowSaveModal(false);
          setSaveLabel("");
          setEditingCommand(null);
        }}
        title={editingCommand ? "Edit Quick Command" : "Save Quick Command"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Label</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g., Create SR Quality Review"
              value={saveLabel}
              onChange={(e) => setSaveLabel(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Command</label>
            <textarea
              className="input-field"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your AI command..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              className="btn-ghost"
              onClick={() => {
                setShowSaveModal(false);
                setSaveLabel("");
                setEditingCommand(null);
              }}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleSaveCommand}
              disabled={!saveLabel.trim() || !prompt.trim()}
            >
              {editingCommand ? "Update" : "Save"}
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

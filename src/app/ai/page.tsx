"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";

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
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch("/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const data = await res.json();
      setResponse(data);

      if (data.success) {
        showToast(data.message, "success");
      } else {
        showToast(data.message || "Operation failed", "error");
      }
    } catch (error) {
      showToast("Failed to process AI request", "error");
      setResponse({
        success: false,
        message: "Network error occurred",
        operations: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const examplePrompts = [
    "Create a template called 'Weekly Sync' with description 'Weekly team sync template'",
    "Create a project called 'Q1 Planning' and add a one-time requirement 'Review goals' due tomorrow",
    "Get all team members",
    "Create a quarterly check-in template with goal areas for 'Engineering Excellence' and 'Customer Success'",
  ];

  return (
    <div className="animate-fadeIn max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">AI Assistant</h1>
        <p className="text-secondary text-sm mt-1">
          Natural language database operations powered by Groq
        </p>
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

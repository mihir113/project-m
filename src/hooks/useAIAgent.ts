import { useState, useCallback } from "react";

interface Operation {
  tool: string;
  status: "success" | "error";
  result?: any;
  error?: string;
  description?: string;
  arguments?: any;
}

interface AgentResponse {
  success: boolean;
  message: string;
  operations: Operation[];
  preview?: boolean;
  plan?: any;
}

interface UseAIAgentOptions {
  onSuccess?: (response: AgentResponse) => void;
  onError?: (error: Error) => void;
  onPreview?: (response: AgentResponse) => void;
}

export function useAIAgent(options: UseAIAgentOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Execute an AI agent command
   * @param prompt - Natural language command
   * @param preview - If true, returns a preview without executing
   * @param confirmedPlan - Optional plan to execute (from preview)
   */
  const execute = useCallback(
    async (prompt: string, preview = false, confirmedPlan?: any) => {
      setLoading(true);
      setError(null);
      setResponse(null);

      try {
        const res = await fetch("/api/ai-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: prompt.trim(),
            preview,
            confirmedPlan,
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data: AgentResponse = await res.json();
        setResponse(data);

        // Handle preview vs execution
        if (data.preview && options.onPreview) {
          options.onPreview(data);
        } else if (data.success && options.onSuccess) {
          options.onSuccess(data);
        } else if (!data.success && options.onError) {
          const errorMsg = (data as any).error || data.message;
          options.onError(new Error(errorMsg));
        }

        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        if (options.onError) {
          options.onError(error);
        }
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [options]
  );

  /**
   * Get a preview of what the AI agent will do
   */
  const preview = useCallback(
    async (prompt: string) => {
      return execute(prompt, true);
    },
    [execute]
  );

  /**
   * Execute a confirmed plan from a preview
   */
  const executeConfirmed = useCallback(
    async (prompt: string, plan: any) => {
      return execute(prompt, false, plan);
    },
    [execute]
  );

  /**
   * Reset the hook state
   */
  const reset = useCallback(() => {
    setResponse(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    execute,
    preview,
    executeConfirmed,
    reset,
    loading,
    response,
    error,
  };
}

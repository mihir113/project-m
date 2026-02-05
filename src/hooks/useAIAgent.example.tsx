/**
 * Example usage of useAIAgent hook
 *
 * This file demonstrates various ways to use the AI agent hook in your components.
 */

import { useAIAgent } from "./useAIAgent";
import { useToast } from "@/components/Toast";

// Example 1: Basic usage with direct execution
export function BasicExample() {
  const { showToast } = useToast();
  const { execute, loading, response } = useAIAgent({
    onSuccess: (data) => showToast(data.message, "success"),
    onError: (error) => showToast(error.message, "error"),
  });

  const handleSubmit = async () => {
    await execute("Get all team members", false); // false = no preview, execute immediately
  };

  return (
    <button onClick={handleSubmit} disabled={loading}>
      {loading ? "Loading..." : "Get Team Members"}
    </button>
  );
}

// Example 2: Preview before execution
export function PreviewExample() {
  const { showToast } = useToast();
  const [previewData, setPreviewData] = useState<any>(null);

  const { preview, executeConfirmed, loading } = useAIAgent({
    onPreview: (data) => {
      setPreviewData(data);
      showToast("Review the plan", "success");
    },
    onSuccess: (data) => {
      showToast(data.message, "success");
      setPreviewData(null);
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const handlePreview = async () => {
    const prompt = "Create a project called 'Q1 Planning'";
    await preview(prompt);
  };

  const handleConfirm = async () => {
    if (previewData) {
      await executeConfirmed(previewData.message, previewData.plan);
    }
  };

  return (
    <div>
      <button onClick={handlePreview} disabled={loading}>
        Preview Command
      </button>

      {previewData && (
        <div>
          <p>Will execute {previewData.operations.length} operations</p>
          <button onClick={handleConfirm} disabled={loading}>
            Confirm & Execute
          </button>
        </div>
      )}
    </div>
  );
}

// Example 3: Multiple commands in sequence
export function SequenceExample() {
  const { execute, loading } = useAIAgent();

  const handleSequence = async () => {
    try {
      // First command
      await execute("Get all team members", false);

      // Second command (waits for first to complete)
      await execute("Create a project called 'Team Sync'", false);

      // Third command
      await execute("Add a weekly requirement to the project", false);
    } catch (error) {
      console.error("Sequence failed:", error);
    }
  };

  return (
    <button onClick={handleSequence} disabled={loading}>
      {loading ? "Executing sequence..." : "Run Sequence"}
    </button>
  );
}

// Example 4: With custom error handling
export function CustomErrorHandling() {
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const { execute, loading, error } = useAIAgent({
    onError: (err) => {
      setErrorDetails(err.message);
      // Custom error tracking
      console.error("AI Agent Error:", err);
    },
  });

  return (
    <div>
      <button onClick={() => execute("Invalid command here", false)}>
        Execute
      </button>

      {errorDetails && (
        <div className="error-message">
          {errorDetails}
        </div>
      )}
    </div>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { aiAgentRateLimiter, getClientIP } from "@/lib/rateLimiter";
import { executeAICommand } from "@/lib/aiAgentCore";

export async function POST(req: NextRequest) {
  // Rate limiting
  const clientIP = getClientIP(req);
  const rateLimit = aiAgentRateLimiter.check(clientIP);

  if (!rateLimit.allowed) {
    const resetInSeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      {
        success: false,
        message: "Rate limit exceeded",
        error: `Too many requests. Please try again in ${resetInSeconds} seconds.`,
        operations: [],
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimit.resetAt.toString(),
          "Retry-After": resetInSeconds.toString(),
        },
      }
    );
  }

  try {
    const body = await req.json();
    const { prompt, preview = false, confirmedPlan } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "prompt is required and must be a string" },
        { status: 400 }
      );
    }

    const result = await executeAICommand({ prompt, preview, confirmedPlan });

    // Add rate limit headers to response
    const rateLimitStatus = aiAgentRateLimiter.getStatus(clientIP);
    const statusCode = result.success || result.preview ? 200 : 500;

    return NextResponse.json(result, {
      status: statusCode,
      headers: {
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Remaining": rateLimitStatus.remaining.toString(),
        "X-RateLimit-Reset": rateLimitStatus.resetAt.toString(),
      },
    });
  } catch (error: any) {
    console.error("AI Agent route error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to process AI request",
        error: error.message || "Unknown error",
        operations: [],
      },
      { status: 500 }
    );
  }
}

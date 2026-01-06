"use client";

import { useEffect } from "react";

/**
 * Suppresses WebSocket connection errors from Inngest Realtime
 * These errors are handled internally by the library and don't affect functionality
 */
export function WebSocketErrorHandler() {
  useEffect(() => {
    // Store original error handler
    const originalError = console.error;

    // Override console.error to filter out WebSocket errors
    console.error = (...args: any[]) => {
      // Check if this is a WebSocket error from Inngest Realtime
      const errorString = JSON.stringify(args);
      const isWebSocketError =
        errorString.includes("WebSocket") ||
        errorString.includes("websocket") ||
        (args[0] && typeof args[0] === "object" && Object.keys(args[0]).length === 0); // Empty object {}

      // Filter out empty error objects and WebSocket-related errors
      if (isWebSocketError) {
        // Silently ignore - these are handled by Inngest Realtime library
        return;
      }

      // Call original error handler for all other errors
      originalError(...args);
    };

    // Cleanup: restore original error handler on unmount
    return () => {
      console.error = originalError;
    };
  }, []);

  return null;
}

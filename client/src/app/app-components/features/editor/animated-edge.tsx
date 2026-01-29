"use client";

import { useMemo } from "react";
import { BaseEdge, EdgeProps, getSmoothStepPath } from "@xyflow/react";
import { useNodeExecutionStatuses } from "./execution-status-store";

// Colors for different connection states
const EDGE_COLORS = {
  default: "#64748b", // Slate gray
  loading: "#3b82f6", // Blue for loading/executing
  success: "#22c55e", // Green for success
  error: "#ef4444", // Red for error
};

export function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  source,
  target,
}: EdgeProps) {
  // Get all node execution statuses
  const nodeStatuses = useNodeExecutionStatuses();

  // Fallback to "initial" when node has no status (not yet run)
  const DEFAULT_STATUS: "initial" | "loading" = "initial";
  const sourceStatus = nodeStatuses[source] ?? DEFAULT_STATUS;
  const targetStatus = nodeStatuses[target] ?? DEFAULT_STATUS;

  // Cascading animation logic:
  // - Edge animates when SOURCE has started/completed AND TARGET is loading
  // - This creates a "data flowing to next node" effect
  // - Animation continues until TARGET completes
  const shouldAnimate = useMemo(() => {
    // If source has started (loading, success, or error) and target is loading
    // This means data is flowing from source to target
    const sourceHasRun =
      sourceStatus === "loading" || sourceStatus === "success" || sourceStatus === "error";
    const targetIsProcessing = targetStatus === "loading";

    return sourceHasRun && targetIsProcessing;
  }, [sourceStatus, targetStatus]);

  // Determine edge color based on the execution state
  const { edgeColor, isCompleted } = useMemo(() => {
    // If target completed successfully, show green
    if (targetStatus === "success") {
      return { edgeColor: EDGE_COLORS.success, isCompleted: true };
    }
    // If target has error, show red
    if (targetStatus === "error") {
      return { edgeColor: EDGE_COLORS.error, isCompleted: true };
    }
    // If animating (data flowing), show blue
    if (shouldAnimate) {
      return { edgeColor: EDGE_COLORS.loading, isCompleted: false };
    }
    // Default gray
    return { edgeColor: EDGE_COLORS.default, isCompleted: false };
  }, [targetStatus, shouldAnimate]);

  // Generate a unique gradient ID
  const gradientId = useMemo(() => {
    return `edge-gradient-${id}`;
  }, [id]);

  // Calculate the path - use smooth step for cleaner look
  const [edgePath] = useMemo(() => {
    return getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 8,
    });
  }, [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition]);

  // Determine stroke width based on state
  const strokeWidth = shouldAnimate || isCompleted ? 3 : 2;

  return (
    <>
      {/* SVG gradient definition */}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop
            offset="0%"
            stopColor={edgeColor}
            stopOpacity={shouldAnimate || isCompleted ? 1 : 0.6}
          />
          <stop
            offset="50%"
            stopColor={edgeColor}
            stopOpacity={shouldAnimate || isCompleted ? 0.8 : 0.3}
          />
          <stop
            offset="100%"
            stopColor={edgeColor}
            stopOpacity={shouldAnimate || isCompleted ? 1 : 0.6}
          />
        </linearGradient>
      </defs>

      {/* Base edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: `url(#${gradientId})`,
          strokeWidth,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }}
      />

      {/* Animated pulse overlay when data is flowing to target */}
      {shouldAnimate && (
        <>
          {/* Glow effect behind the pulse */}
          <path
            d={edgePath}
            fill="none"
            stroke={edgeColor}
            strokeWidth={12}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              opacity: 0.15,
              filter: "blur(6px)",
              animation: "glowPulse 1.5s ease-in-out infinite",
            }}
          />
          {/* Animated flowing pulse using stroke-dasharray */}
          <path
            d={edgePath}
            fill="none"
            stroke={edgeColor}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="20 30"
            style={{
              animation: "flowPulse 1s linear infinite",
            }}
          />
        </>
      )}

      {/* Success/completed glow effect */}
      {isCompleted && (
        <path
          d={edgePath}
          fill="none"
          stroke={edgeColor}
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            opacity: 0.2,
            filter: "blur(4px)",
          }}
        />
      )}

      {/* Invisible wider path for easier selection */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={15}
        stroke="transparent"
        className="react-flow__edge-interaction"
      />
    </>
  );
}

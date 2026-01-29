"use client";

import type { NodeProps } from "@xyflow/react";
import { memo, useState, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { BaseExecutionNode } from "../anthropic/base-execution-node";
import { OutputDialog, OutputFormValues } from "./dialog";
import { useReactFlow } from "@xyflow/react";
import { useNodeStatus } from "@/app/app-components/features/executions/hooks/use-node-status";
import { useWorkflowOutputs } from "@/app/app-components/features/editor/workflow-outputs-store";
import { Download, Maximize2 } from "lucide-react";

type OutputNodeData = {
  variables?: string;
  contentType?: "image" | "video" | "audio";
  imageSource?: string;
  videoSource?: string;
  audioSource?: string;
  outputFilename?: string;
  [key: string]: unknown;
};

/**
 * Parse a Handlebars-style template like "{{designPro.imageUrl}}"
 * and extract the path parts: ["designPro", "imageUrl"]
 */
function parseTemplatePath(template: string): string[] | null {
  if (!template) return null;
  // Match {{variableName.path.to.value}} or {{variableName}}
  const match = template.match(/\{\{([^}]+)\}\}/);
  if (!match) return null;
  return match[1].trim().split(".");
}

function normalizeContentType(value?: string): "image" | "video" | "audio" {
  if (value === "image" || value === "video" || value === "audio") {
    return value;
  }
  return "image";
}

/**
 * Get a nested value from an object using a path array
 * e.g., getNestedValue({ designPro: { imageUrl: "http://..." } }, ["designPro", "imageUrl"])
 */
function getNestedValue(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Add ngrok-skip-browser-warning query param to ngrok URLs
 * This bypasses the interstitial page that breaks image/video/audio loading
 */
function processMediaUrl(url: string): string {
  if (!url) return url;

  // Check if it's an ngrok URL
  if (url.includes(".ngrok") || url.includes("ngrok-free.app")) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}ngrok-skip-browser-warning=true`;
  }

  return url;
}

export const OutputNode = memo((props: NodeProps) => {
  const { data } = props;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const { setNodes } = useReactFlow();

  // Get node's own status
  const { status: nodeStatus } = useNodeStatus({
    nodeId: props.id,
  });

  // Get ALL workflow outputs from the global store
  const workflowOutputs = useWorkflowOutputs();

  const nodeData = (data || {}) as OutputNodeData;

  // Determine content type and get the appropriate source template
  const contentType = normalizeContentType(nodeData.contentType);
  const sourceTemplate = useMemo(() => {
    switch (contentType) {
      case "video":
        return nodeData.videoSource;
      case "audio":
        return nodeData.audioSource;
      case "image":
      default:
        return nodeData.imageSource;
    }
  }, [contentType, nodeData.imageSource, nodeData.videoSource, nodeData.audioSource]);

  // Parse the template and get content directly from the GLOBAL workflow outputs
  // This allows us to display content IMMEDIATELY when ANY source node completes
  const rawContent = useMemo(() => {
    if (!sourceTemplate) return null;
    const trimmed = sourceTemplate.trim();

    // If source is a direct URL, use it as-is
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("data:")
    ) {
      return trimmed;
    }

    if (!workflowOutputs) return null;

    const path = parseTemplatePath(trimmed);
    if (!path) return null;

    const value = getNestedValue(workflowOutputs, path);
    return typeof value === "string" ? value : null;
  }, [workflowOutputs, sourceTemplate]);

  // Process the content URL for media types (handles ngrok URLs)
  const content = useMemo(() => {
    if (!rawContent) return null;
    return processMediaUrl(rawContent);
  }, [rawContent]);

  const proxyUrl = useMemo(() => {
    if (!content) return null;
    if (content.startsWith("http://") || content.startsWith("https://")) {
      return `/api/media-proxy?url=${encodeURIComponent(content)}`;
    }
    return content;
  }, [content]);

  useEffect(() => {
    if (!sourceTemplate) return;
    // Debug: see exactly what we resolve and display.
    console.debug("[OutputNode] resolved media source", {
      nodeId: props.id,
      contentType,
      sourceTemplate,
      rawContent,
      content,
      proxyUrl,
    });
  }, [content, contentType, props.id, proxyUrl, rawContent, sourceTemplate]);

  // Resolve media URL for preview (no fetch to avoid CORS issues)
  useEffect(() => {
    let isMounted = true;

    const resolveMedia = async () => {
      if (!proxyUrl) {
        if (isMounted) {
          setMediaUrl(null);
          setMediaLoading(false);
        }
        return;
      }

      // Data and http(s) URLs can be used directly by media elements.
      if (isMounted) {
        setMediaUrl(proxyUrl);
        setMediaLoading(false);
      }
    };

    resolveMedia();

    return () => {
      isMounted = false;
    };
  }, [proxyUrl]);

  // Check if we have content to display
  const hasContent = mediaUrl !== null && mediaUrl.length > 0;

  const description = useMemo(() => {
    const typeLabel = contentType.charAt(0).toUpperCase() + contentType.slice(1);
    return `${typeLabel} output`;
  }, [contentType]);

  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: OutputFormValues) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === props.id) {
          return {
            ...node,
            data: {
              ...node.data,
              ...values,
            },
          };
        }
        return node;
      })
    );
  };

  // Download by fetching and saving the extracted media
  const handleDownload = useCallback(async () => {
    if (!content) return;

    const timestamp = Date.now();
    let extension = "bin";
    if (contentType === "image") extension = "jpg";
    if (contentType === "video") extension = "mp4";
    if (contentType === "audio") extension = "mp3";

    const filename = nodeData.outputFilename
      ? `${nodeData.outputFilename}.${extension}`
      : `output-${timestamp}.${extension}`;

    try {
      const downloadUrl = proxyUrl ?? content;
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status}`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Fallback: open in new tab if download fails
      window.open(content, "_blank", "noopener,noreferrer");
    }
  }, [content, contentType, nodeData.outputFilename]);

  // Determine display status - show success as soon as content is available
  const displayStatus = hasContent ? "success" : nodeStatus;

  return (
    <>
      <OutputDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        icon="/logo/output.svg"
        name="Output"
        description={description}
        status={displayStatus}
        output={workflowOutputs}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
        iconColor="!text-emerald-600 dark:!text-emerald-400"
        handleColor="!border-emerald-500 !bg-emerald-500"
      >
        {/* Content Preview - show IMMEDIATELY when content is available from any source node */}
        {hasContent && (
          <div className="mt-2 w-full min-w-[260px] rounded-md overflow-hidden bg-neutral-900/50 border border-neutral-700 min-h-[150px]">
            {/* Image Content */}
            {contentType === "image" && mediaUrl && (
              <div className="relative group">
                <img
                  src={mediaUrl}
                  alt="Output"
                  className="w-full max-h-32 object-contain cursor-pointer"
                  onClick={() => setShowLightbox(true)}
                />
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setShowLightbox(true)}
                    className="p-1 bg-black/50 rounded hover:bg-black/70 text-white"
                    title="View full size"
                  >
                    <Maximize2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={handleDownload}
                    className="p-1 bg-black/50 rounded hover:bg-black/70 text-white"
                    title="Open in new tab"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Video Content */}
            {contentType === "video" && mediaUrl && (
              <div className="relative group">
                <video
                  src={mediaUrl}
                  controls
                  loop
                  playsInline
                  className="w-full max-h-56 object-contain"
                />
              </div>
            )}

            {/* Audio Content */}
            {contentType === "audio" && mediaUrl && (
              <div className="p-4 space-y-3">
                <audio src={mediaUrl} controls className="w-full h-10" />
              </div>
            )}
          </div>
        )}

        {/* Placeholder when no content */}
        {!hasContent && (
          <div className="mt-2 p-3 rounded-md border border-dashed border-neutral-600 text-center">
            <span className="text-[10px] text-neutral-500">
              {mediaLoading
                ? "Loading media..."
                : nodeStatus === "loading"
                  ? "Processing..."
                  : "Waiting for output"}
            </span>
          </div>
        )}
      </BaseExecutionNode>

      {/* Lightbox Modal for Images (portal to avoid transformed parent issues) */}
      {showLightbox &&
        mediaUrl &&
        contentType === "image" &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-8"
            onClick={() => setShowLightbox(false)}
          >
            <div className="relative max-w-full max-h-full">
              <img
                src={mediaUrl}
                alt="Output full size"
                className="max-w-full max-h-[90vh] object-contain rounded"
              />
              <div className="absolute top-4 right-4 flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload();
                  }}
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded text-white transition-colors flex items-center justify-center"
                  title="Open in new tab"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowLightbox(false)}
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded text-white transition-colors flex items-center justify-center"
                  title="Close"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
});

OutputNode.displayName = "OutputNode";

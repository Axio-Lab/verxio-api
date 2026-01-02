"use client";

import {type ReactNode } from "react";
import {
  Handle,
  Position,
  type NodeProps,
} from "@xyflow/react";

import { BaseNode } from "@/components/base-node";
import type { NodeStatus } from "@/components/node-status-indicator";

export type PlaceholderNodeProps = Partial<NodeProps> & {
  children?: ReactNode;
  onClick?: () => void;
  status?: NodeStatus;
};

export function PlaceholderNode({ children, onClick, status = "initial" }: PlaceholderNodeProps) {
 

  return (
    <BaseNode
      className="bg-card w-auto h-auto border-dashed border-gray-400 p-4 text-center text-gray-400 shadow-none 
      cursor-pointer hover:border-gray-500 hover:bg-50"
      onClick={onClick}
      status={status}
    >
      {children}
      <Handle
        type="target"
        style={{ visibility: "hidden" }}
        position={Position.Top}
        isConnectable={false}
      />
      <Handle
        type="source"
        style={{ visibility: "hidden" }}
        position={Position.Bottom}
        isConnectable={false}
      />
    </BaseNode>
  );
}

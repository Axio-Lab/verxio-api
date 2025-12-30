import { NodeTypes } from "@xyflow/react";
import { InitialNode } from "@/app/app-components/features/initial-node";


const NodeType = {
  INITIAL: 'INITIAL',
} as const;


export const NodeComponents = {
  [NodeType.INITIAL]: InitialNode,
} as const satisfies NodeTypes;

export type RegisteredNodeType = keyof typeof NodeComponents;
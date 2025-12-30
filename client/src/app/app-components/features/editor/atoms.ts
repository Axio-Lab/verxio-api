import type { ReactFlowInstance } from '@xyflow/react';
import { atom } from 'jotai';

export const editorAtom = atom<ReactFlowInstance | null>(null);
export const hasUnsavedChangesAtom = atom<boolean>(false);
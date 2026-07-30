import type { PaperPreset } from './paper';

export interface RenderNode {
  type: string;
  content: string;
  style: Record<string, unknown>;
  children?: RenderNode[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface RenderPage {
  width: number;
  height: number;
  nodes: RenderNode[];
}

export interface RenderDocument {
  paper: PaperPreset;
  pages: RenderPage[];
}

export interface PreviewResult extends RenderDocument {
  debug?: {
    unresolvedFields: string[];
    hiddenNodes: string[];
  };
}

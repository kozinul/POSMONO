import { PaperPreset } from '../../types/paper';
import { DocumentData } from '../../types/document-data';
import { RenderPage, RenderNode } from '../../types/layout';
import { DocumentNode, FieldNode, TextNode } from '../../types/template';
import { ResolvedNode } from '../../engine/VariableResolver';

export class ThermalLayoutCalculator {
  calculate(
    resolvedSections: { section: { id: string; type: string }; nodes: ResolvedNode[] }[],
    _data: DocumentData,
    paper: PaperPreset,
  ): RenderPage[] {
    const printableWidth = paper.width - paper.margin.left - paper.margin.right;
    const nodes: RenderNode[] = [];
    let currentY = paper.margin.top;

    for (const sec of resolvedSections) {
      const visibleNodes = sec.nodes.filter((n) => n.isVisible);
      if (visibleNodes.length === 0) continue;

      for (const resolved of visibleNodes) {
        this.flattenNode(resolved, nodes, currentY, paper, printableWidth);
      }

      // Advance Y past all rendered nodes in this section
      const maxY = nodes
        .filter((n) => n.y !== undefined)
        .reduce((max, n) => Math.max(max, n.y! + (n.height || 0)), currentY);
      currentY = Math.max(currentY + 2, maxY + 2);
    }

    const page: RenderPage = {
      width: paper.width,
      height: currentY + paper.margin.bottom,
      nodes,
    };

    return [page];
  }

  private flattenNode(
    resolved: ResolvedNode,
    nodes: RenderNode[],
    y: number,
    paper: PaperPreset,
    printableWidth: number,
  ): void {
    if (resolved.children && resolved.children.length > 0) {
      let childY = y;
      for (const child of resolved.children) {
        if (child.isVisible) {
          this.flattenNode(child, nodes, childY, paper, printableWidth);
          const lastChild = nodes[nodes.length - 1];
          childY = lastChild ? lastChild.y! + (lastChild.height || 0) : childY;
        }
      }
      return;
    }

    const content = this.resolveContent(resolved, paper);
    if (content === '' && resolved.node.type === 'spacer') {
      const spacerHeight = (resolved.node as any).height ?? 4;
      nodes.push({
        type: resolved.node.type,
        content: '',
        style: (resolved.node.style || {}) as Record<string, unknown>,
        x: paper.margin.left,
        y,
        width: printableWidth,
        height: spacerHeight,
      });
      return;
    }

    const charWidth = this.getCharWidth(paper);
    const lineHeight = this.getLineHeight(resolved.node);
    const maxChars = Math.floor(printableWidth / charWidth);
    const lines = this.wrapText(content, maxChars);
    const height = lines.length * lineHeight;

    nodes.push({
      type: resolved.node.type,
      content,
      style: (resolved.node.style || {}) as Record<string, unknown>,
      x: paper.margin.left,
      y,
      width: printableWidth,
      height,
    });
  }
  private resolveContent(resolved: ResolvedNode, paper: PaperPreset): string {
    const node = resolved.node;

    switch (node.type) {
      case 'divider':
        return '─'.repeat(paper.type === 'thermal58' ? 32 : 48);
      case 'spacer':
        return '';
      case 'field':
        return resolved.content;
      case 'text':
        return resolved.content;
      case 'table':
        return resolved.content;
      default:
        return '';
    }
  }

  private getCharWidth(paper: PaperPreset): number {
    if (paper.type === 'thermal58') return 0.85;
    if (paper.type === 'thermal80') return 0.6;
    return 0.35;
  }

  private getLineHeight(_node: DocumentNode): number {
    return 4;
  }

  private wrapText(text: string, maxChars: number): string[] {
    if (maxChars <= 0) return [text];
    const lines: string[] = [];
    for (let i = 0; i < text.length; i += maxChars) {
      lines.push(text.slice(i, i + maxChars));
    }
    return lines.length === 0 ? [''] : lines;
  }
}

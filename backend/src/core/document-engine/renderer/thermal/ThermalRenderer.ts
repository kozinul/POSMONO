import { RenderDocument, RenderNode, RenderPage } from '../../types/layout';

const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;
const FF = 0x0C;

export class ThermalRenderer {
  render(doc: RenderDocument): Buffer {
    const chunks: Uint8Array[] = [];

    chunks.push(this.write([ESC, 0x40]));

    for (const page of doc.pages) {
      const pageBuf = this.renderPage(page, doc);
      chunks.push(pageBuf);
    }

    chunks.push(this.write([GS, 0x56, 0x00]));

    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
  }

  private renderPage(page: RenderPage, doc: RenderDocument): Uint8Array {
    const chunks: Uint8Array[] = [];
    const printableWidth = doc.paper.width - doc.paper.margin.left - doc.paper.margin.right;
    const maxChars = doc.paper.type === 'thermal58' ? 32 : 48;

    for (const node of page.nodes) {
      const buf = this.renderNode(node, maxChars, printableWidth);
      if (buf.length > 0) chunks.push(buf);
    }

    return this.concat(chunks);
  }

  private renderNode(node: RenderNode, maxChars: number, printableWidth: number): Uint8Array {
    switch (node.type) {
      case 'field':
      case 'text':
      case 'table':
        return this.renderText(node, maxChars);
      case 'divider': {
        const line = '─'.repeat(maxChars);
        return this.writeText(line, node, maxChars);
      }
      case 'spacer': {
        const height = (node.height ?? 4) / 4;
        return this.write([ESC, 0x64, Math.max(1, Math.round(height))]);
      }
      case 'barcode': {
        const content = node.content || ' ';
        const buf: number[] = [];
        buf.push(GS, 0x68, 50);
        buf.push(GS, 0x77, 2);
        buf.push(GS, 0x6B, 0x49);
        const len = Math.min(content.length, 255);
        buf.push(len);
        for (let i = 0; i < len; i++) buf.push(content.charCodeAt(i));
        buf.push(LF);
        return new Uint8Array(buf);
      }
      case 'qrcode': {
        const content = node.content || ' ';
        const buf: number[] = [];
        const len = Math.min(content.length, 255);
        const pl = len + 3;
        buf.push(GS, 0x28, 0x6B, pl % 256, Math.floor(pl / 256), 0x31, 0x50, 0x30);
        buf.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 8);
        buf.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30);
        const dLen = len + 3;
        buf.push(GS, 0x28, 0x6B, dLen % 256, Math.floor(dLen / 256), 0x31, 0x44, 0x31, 0x44);
        for (let i = 0; i < len; i++) buf.push(content.charCodeAt(i));
        buf.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);
        buf.push(LF);
        return new Uint8Array(buf);
      }
      default:
        return new Uint8Array(0);
    }
  }

  private renderText(node: RenderNode, maxChars: number): Uint8Array {
    const style = node.style as Record<string, any>;
    const font = style?.font ?? {};

    const cmd: number[] = [];

    if (font?.align === 'center') cmd.push(ESC, 0x61, 0x01);
    else if (font?.align === 'right') cmd.push(ESC, 0x61, 0x02);
    else cmd.push(ESC, 0x61, 0x00);

    const bold = font?.weight === 'bold' ? 0x01 : 0x00;
    cmd.push(ESC, 0x45, bold);

    if (font?.size) {
      const sizeCode = Math.min(7, Math.max(0, Math.round(font.size / 4) - 1));
      cmd.push(GS, 0x21, sizeCode);
    }

    const lines = this.wrapText(node.content, maxChars);
    for (const line of lines) {
      for (let i = 0; i < line.length; i++) cmd.push(line.charCodeAt(i));
      cmd.push(LF);
    }

    cmd.push(ESC, 0x61, 0x00);
    cmd.push(ESC, 0x45, 0x00);
    cmd.push(GS, 0x21, 0x00);

    return new Uint8Array(cmd);
  }

  private writeText(text: string, node: RenderNode, maxChars: number): Uint8Array {
    const style = node.style as Record<string, any>;
    const font = style?.font ?? {};
    const cmd: number[] = [];

    if (font?.align === 'center') cmd.push(ESC, 0x61, 0x01);
    else cmd.push(ESC, 0x61, 0x00);

    const lines = this.wrapText(text, maxChars);
    for (const line of lines) {
      for (let i = 0; i < line.length; i++) cmd.push(line.charCodeAt(i));
      cmd.push(LF);
    }

    cmd.push(ESC, 0x61, 0x00);
    return new Uint8Array(cmd);
  }

  private wrapText(text: string, maxChars: number): string[] {
    if (maxChars <= 0) return [text];
    const lines: string[] = [];
    for (let i = 0; i < text.length; i += maxChars) {
      lines.push(text.slice(i, i + maxChars));
    }
    return lines.length === 0 ? [''] : lines;
  }

  private write(bytes: number[]): Uint8Array {
    return new Uint8Array(bytes);
  }

  private concat(chunks: Uint8Array[]): Uint8Array {
    const total = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
}

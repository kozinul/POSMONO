import PDFDocument from 'pdfkit';
import { RenderDocument, RenderNode } from '../../types/layout';

export class PdfRenderer {
  render(doc: RenderDocument): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const pdf = new PDFDocument({
        size: this.getPageSize(doc.paper),
        margins: {
          top: doc.paper.margin.top,
          bottom: doc.paper.margin.bottom,
          left: doc.paper.margin.left,
          right: doc.paper.margin.right,
        },
        autoFirstPage: false,
      });

      const chunks: Buffer[] = [];
      pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdf.on('end', () => resolve(Buffer.concat(chunks)));
      pdf.on('error', reject);

      for (const page of doc.pages) {
        pdf.addPage();
        for (const node of page.nodes) {
          this.renderNode(pdf, node, doc);
        }
      }

      pdf.end();
    });
  }

  private getPageSize(paper: { type: string; width: number; height: number | string }): [number, number] {
    if (paper.type === 'a4-portrait') return [595.28, 841.89];
    if (paper.type === 'a4-landscape') return [841.89, 595.28];
    const w = (paper.width as number) * 2.835;
    const h = paper.height === 'auto' ? 2000 : (paper.height as number) * 2.835;
    return [w, h];
  }

  private renderNode(pdf: PDFKit.PDFDocument, node: RenderNode, doc: RenderDocument): void {
    const x = node.x ?? doc.paper.margin.left;
    const y = node.y ?? doc.paper.margin.top;
    const style = node.style as Record<string, any>;
    const font = style?.font ?? {};

    const fontSize = (font?.size as number) ?? 10;
    const align = (font?.align as string) ?? 'left';
    const bold = font?.weight === 'bold';

    switch (node.type) {
      case 'field':
      case 'text':
      case 'table': {
        pdf.font(bold ? 'Helvetica-Bold' : 'Helvetica');
        pdf.fontSize(fontSize);
        pdf.text(node.content, x, y, {
          width: node.width,
          align: align as 'left' | 'center' | 'right',
          lineBreak: true,
        });
        break;
      }
      case 'divider': {
        const w = node.width ?? (doc.paper.width - doc.paper.margin.left - doc.paper.margin.right);
        pdf.moveTo(x, y).lineTo(x + w, y).stroke();
        break;
      }
      case 'spacer':
        break;
      case 'image': {
        if (node.content) {
          try {
            const imgWidth = Math.min(node.width ?? 120, 120);
            const imgHeight = node.height ?? 12;
            pdf.image(node.content, x, y, { width: imgWidth, height: imgHeight, fit: [imgWidth, imgHeight] });
          } catch {
            // ignore invalid/unloadable image sources
          }
        }
        break;
      }
      case 'barcode':
        pdf.fontSize(8).text(node.content || ' ', x, y);
        break;
      case 'qrcode':
        pdf.fontSize(8).text(node.content || ' ', x, y);
        break;
    }
  }
}

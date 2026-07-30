import { Template, DocumentSection, DocumentNode } from '../types/template';
import { DocumentData } from '../types/document-data';
import { RenderDocument, PreviewResult, RenderPage, RenderNode } from '../types/layout';
import { VariableResolver } from '../engine/VariableResolver';
import { SectionSorter } from '../engine/SectionSorter';
import { ThermalLayoutCalculator } from './thermal/ThermalLayoutCalculator';
import { ThermalRenderer } from './thermal/ThermalRenderer';
import { PdfRenderer } from './pdf/PdfRenderer';
import { FieldRegistry } from '../registry/FieldRegistry';
import { ComponentRegistry } from '../registry/ComponentRegistry';
import { PaperRegistry } from '../registry/PaperRegistry';

export class DocumentRenderer {
  private thermalRenderer = new ThermalRenderer();
  private pdfRenderer = new PdfRenderer();

  constructor(
    private readonly fieldRegistry: FieldRegistry,
    private readonly componentRegistry: ComponentRegistry,
    private readonly paperRegistry: PaperRegistry,
  ) {}

  render(template: Template, data: DocumentData): RenderDocument {
    const resolver = new VariableResolver();
    const { resolvedSections } = resolver.resolve(template.sections, data);

    const paper = this.paperRegistry.get(template.paper.type) || template.paper;
    const calculator = new ThermalLayoutCalculator();
    const pages = calculator.calculate(resolvedSections, data, paper);

    return { paper, pages };
  }

  renderPreview(template: Template, data: DocumentData): PreviewResult {
    const resolver = new VariableResolver();
    const { resolvedSections, unresolvedFields } = resolver.resolve(template.sections, data);

    const paper = this.paperRegistry.get(template.paper.type) || template.paper;
    const calculator = new ThermalLayoutCalculator();
    const pages = calculator.calculate(resolvedSections, data, paper);

    const preview: PreviewResult = { paper, pages };
    preview.debug = {
      unresolvedFields,
      hiddenNodes: [],
    };
    return preview;
  }

  renderThermal(template: Template, data: DocumentData): Buffer {
    const doc = this.render(template, data);
    return this.thermalRenderer.render(doc);
  }

  async renderPdf(template: Template, data: DocumentData): Promise<Buffer> {
    const doc = this.render(template, data);
    return this.pdfRenderer.render(doc);
  }
}

import { DocumentSection } from '../types/template';

export class SectionSorter {
  sort(sections: DocumentSection[]): DocumentSection[] {
    return [...sections]
      .filter((s) => s.enabled)
      .sort((a, b) => a.order - b.order);
  }
}

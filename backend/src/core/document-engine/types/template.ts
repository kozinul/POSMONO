import { PaperPreset } from './paper';

export type DocumentType = 'receipt' | 'invoice' | 'kot' | 'label' | 'report' | 'slip';
type SectionType =
  | 'header' | 'store_info' | 'order_info' | 'customer_info'
  | 'items' | 'item_modifiers' | 'item_adjustments'
  | 'summary' | 'payment' | 'tax_detail' | 'footer' | 'qrcode' | 'barcode';

type ComponentType =
  | 'field' | 'text' | 'image' | 'divider' | 'spacer'
  | 'qrcode' | 'barcode' | 'line_separator'
  | 'container' | 'row' | 'column' | 'table' | 'repeater';

export type VisibilityOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'exists' | 'not_exists';

export interface VisibilityRule {
  field: string;
  operator: VisibilityOperator;
  value?: string | number | boolean;
}

type VisibilityLogicalOperator = 'AND' | 'OR' | 'NOT';

export interface VisibilityGroup {
  operator: VisibilityLogicalOperator;
  rules: VisibilityRule[];
  groups?: VisibilityGroup[];
}

type ComponentDimension =
  | { unit: 'auto' }
  | { unit: 'mm'; value: number }
  | { unit: 'percent'; value: number };

interface BoxEdges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface ComponentStyle {
  margin?: BoxEdges;
  padding?: BoxEdges;
  font?: {
    size?: number;
    weight?: 'normal' | 'bold';
    style?: 'normal' | 'italic';
    align?: 'left' | 'center' | 'right';
    transform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  };
  color?: string;
  backgroundColor?: string;
  border?: {
    width: number;
    color: string;
    radius: number;
    style: 'solid' | 'dashed' | 'dotted';
  };
}

interface BaseNode {
  id: string;
  style?: ComponentStyle;
  visibility?: VisibilityGroup;
}

export interface FieldNode extends BaseNode {
  type: 'field';
  field: string;
  label?: string;
  format?: string;
}

export interface TextColumn {
  text: string;
  align?: 'left' | 'right';
  format?: string;
}

export interface TextNode extends BaseNode {
  type: 'text';
  text?: string;
  columns?: TextColumn[];
}

export interface ImageNode extends BaseNode {
  type: 'image';
  field: string;
  maxWidth?: number;
  maxHeight?: number;
}

interface DividerNode extends BaseNode {
  type: 'divider';
}

interface SpacerNode extends BaseNode {
  type: 'spacer';
  height: number;
}

interface BarcodeNode extends BaseNode {
  type: 'barcode';
  field: string;
}

interface QrNode extends BaseNode {
  type: 'qrcode';
  content: string;
}

interface ContainerNode extends BaseNode {
  type: 'container';
  layout?: 'vertical' | 'horizontal';
  children: DocumentNode[];
}

interface RowNode extends BaseNode {
  type: 'row';
  children: ColumnNode[];
}

interface ColumnNode extends BaseNode {
  type: 'column';
  width?: ComponentDimension;
  children: DocumentNode[];
}

export interface TableColumn {
  field: string;
  header: string;
  width?: ComponentDimension;
  align?: 'left' | 'center' | 'right';
  format?: string;
}

export interface TableNode extends BaseNode {
  type: 'table';
  columns: TableColumn[];
  dataSource: string;
  headerStyle?: ComponentStyle;
}

export interface RepeaterNode extends BaseNode {
  type: 'repeater';
  dataSource: string;
  template: DocumentNode[];
}

export type DocumentNode =
  | FieldNode | TextNode | ImageNode | DividerNode | SpacerNode
  | BarcodeNode | QrNode
  | ContainerNode | RowNode | ColumnNode | TableNode | RepeaterNode;

export interface DocumentSection {
  id: string;
  type: SectionType;
  enabled: boolean;
  order: number;
  nodes: DocumentNode[];
}

export interface TemplateMetadata {
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  version: number;
  createdBy: string;
  tags?: string[];
}

export interface Template {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  schemaVersion: number;
  documentType: DocumentType;
  paper: PaperPreset;
  sections: DocumentSection[];
  metadata: TemplateMetadata;
}

interface TemplateVersion {
  id: string;
  templateId: string;
  version: number;
  template: Template;
  changeDescription?: string;
  createdBy: string;
  createdAt: string;
  status: 'draft' | 'published';
}

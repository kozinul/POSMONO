# Receipt Template Designer — Software Product Specification

> **Product:** Kuire POS
> **Module:** Document Template Engine
> **Status:** Specification (v1.0)
> **Last Updated:** 2026-07-29

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision](#2-product-vision)
3. [Scope & Boundaries](#3-scope--boundaries)
4. [User Personas](#4-user-personas)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [System Architecture](#7-system-architecture)
8. [Data Model](#8-data-model)
9. [Component Tree](#9-component-tree)
10. [API Design](#10-api-design)
11. [UI/UX Specification](#11-uiux-specification)
12. [Engine API Reference](#12-engine-api-reference)
13. [Implementation Phases](#13-implementation-phases)
14. [Glossary](#14-glossary)

---

## 1. Executive Summary

The **Receipt Template Designer** is a drag-and-drop visual layout editor that allows merchants to design the look and feel of printed documents (receipts, invoices, kitchen tickets, labels, reports) without writing code.

This is not a single-purpose receipt designer. It is the UI layer of a **Universal Document Template Engine** that decouples document layout from business logic. Every document in Kuire — from thermal receipts to A4 invoices to barcode labels — will use the same engine, differentiated only by the template selected.

---

## 2. Product Vision

### 2.1 Vision Statement

> Every merchant should be able to customise every printed document to match their brand identity, without writing a single line of code.

### 2.2 Strategic Goals

| Goal | Description |
|------|-------------|
| **Unified Engine** | One template engine powers all document types — receipt, invoice, KOT, label, report, slip |
| **No-Code Customisation** | Merchants design documents visually via drag & drop; no HTML/CSS/JS knowledge required |
| **Design Once, Print Anywhere** | A single template renders identically across thermal (ESC/POS), laser (PDF), and mobile |
| **Version-Controlled** | Every template change is tracked, draftable, publishable, and rollback-able |
| **Extensible by Design** | New field types, section types, and document types can be added without modifying core engine |

### 2.3 Future Document Types

The engine must support all of these without structural changes:

| Document Type | Target Output | Priority |
|---------------|---------------|----------|
| Receipt Thermal 58mm | Thermal printer | P0 |
| Receipt Thermal 80mm | Thermal printer | P0 |
| Invoice A4 | PDF / Laser printer | P1 |
| Kitchen Order Ticket (KOT) | Thermal printer | P1 |
| Delivery Slip | Thermal / A4 | P1 |
| Barcode Label | Label printer (40x30mm) | P2 |
| Shift Report | A4 PDF | P2 |
| Cash Out Report | A4 PDF | P2 |
| Purchase Order | A4 PDF | P3 |
| Sales Order | A4 PDF | P3 |

---

## 3. Scope & Boundaries

### 3.1 In Scope

- Visual drag-and-drop template designer UI
- Section, field, and component libraries
- Property editor panel (position, typography, visibility)
- JSON-based template storage (no HTML templates)
- Live preview with sample data switching
- Template CRUD, duplicate, export/import JSON
- Draft/publish workflow with version history
- Conditional visibility engine
- Document renderer (server-side + client-side preview)
- Thermal 58mm, Thermal 80mm, A4 Portrait, A4 Landscape presets

### 3.2 Out of Scope (v1)

- Actual printer driver integration (ESC/POS, IPP) — handled by existing Print Service
- PDF generation — handled by existing Report Service
- Multi-language template translations
- Collaborative editing (real-time multi-user)
- Template marketplace / sharing
- AI-powered layout suggestions
- WYSIWYG image editing (crop, filter)

### 3.3 Boundaries

- The **Engine** is agnostic of document type — it renders data + template → output. Document type is just a paper preset + field availability filter.
- The **Designer** is the UI that produces templates. It consumes the Engine for preview but is otherwise independent.
- The **Data Model** (Receipt Model) is the source of truth for available variables. Templates reference variables by path, not by hardcoded labels.

---

## 4. User Personas

### 4.1 Store Owner / Manager

- **Goal:** Customise receipts to show logo, promo messages, social media
- **Skill:** Non-technical, but comfortable with drag-and-drop tools (Canva, Wix)
- **Needs:** Simple interface, preset templates, preview with real data

### 4.2 Admin / Power User

- **Goal:** Build complex templates with conditional visibility, multiple sections
- **Skill:** Tech-savvy, comfortable with JSON export/import
- **Needs:** Full property control, version history, duplicate from existing

### 4.3 Developer (Internal / Integrator)

- **Goal:** Extend the engine with new field types, document types
- **Skill:** Proficient in TypeScript/React
- **Needs:** Well-documented plugin API, typed interfaces, backward compatibility

---

## 5. Functional Requirements

### 5.1 Template Designer UI

#### FR-01: Three-Panel Layout

```text
┌──────────── Toolbox ───────────┬──────────── Canvas ────────────┬──────────── Properties ────────────┐
│                                │                                │                                     │
│ Section Library                │ Document Preview               │ Selected Component                 │
│                                │                                │                                     │
│ Field Library                  │ Drag & Drop Area              │ Position                           │
│                                │                                │ Margin                             │
│ Component Library              │                                │ Padding                            │
│                                │                                │ Alignment                          │
│                                │                                │ Font                               │
│                                │                                │ Visibility                         │
└────────────────────────────────┴────────────────────────────────┴─────────────────────────────────────┘
```

#### FR-02: Section Library

Available sections (draggable to canvas, reorderable, toggleable):

| Section ID | Description | Default Enabled |
|---|---|---|
| `header` | Store logo + name | Yes |
| `store_info` | Address, phone, email, website, tax number, merchant ID | Yes |
| `order_info` | Order/invoice number, type, table, queue, cashier, shift, date, time | Yes |
| `customer_info` | Customer name, member number, phone, email, company, tax ID | Conditional |
| `items` | Line items table (product, SKU, qty, price, total, note) | Yes |
| `item_modifiers` | Per-item modifier breakdown | Yes |
| `item_adjustments` | Per-item line adjustments (promo, discount, charge) | Yes |
| `summary` | Subtotal, discounts, charges, tax, rounding, grand total | Yes |
| `payment` | Payment method, paid amount, change, approval code, card number, QR ref | Yes |
| `tax_detail` | Per-tax breakdown with rates | Conditional |
| `footer` | Thank you, return policy, promo text, social media, survey QR | Yes |
| `qrcode` | QR code for digital receipt / payment | Conditional |
| `barcode` | Barcode for order number | Conditional |

#### FR-03: Field Library

Each section provides a set of fields that can be dragged onto the canvas. Fields are typed and map directly to the Receipt Model.

**Store fields:** `{{store.name}}`, `{{store.address}}`, `{{store.phone}}`, `{{store.email}}`, `{{store.website}}`, `{{store.taxNumber}}`, `{{store.merchantId}}`, `{{store.logo}}`

**Order fields:** `{{order.invoiceNumber}}`, `{{order.orderNumber}}`, `{{order.type}}`, `{{order.table}}`, `{{order.queueNumber}}`, `{{order.cashier}}`, `{{order.shift}}`, `{{order.date}}`, `{{order.time}}`

**Customer fields:** `{{customer.name}}`, `{{customer.memberNumber}}`, `{{customer.phone}}`, `{{customer.email}}`, `{{customer.company}}`, `{{customer.taxId}}`

**Item fields:** `{{item.name}}`, `{{item.sku}}`, `{{item.barcode}}`, `{{item.qty}}`, `{{item.unitPrice}}`, `{{item.totalPrice}}`, `{{item.note}}`

**Modifier fields:** `{{modifier.name}}`, `{{modifier.price}}`

**Adjustment fields:** `{{adjustment.name}}`, `{{adjustment.type}}`, `{{adjustment.amount}}`

**Summary fields:** `{{summary.subtotal}}`, `{{summary.orderDiscount}}`, `{{summary.voucher}}`, `{{summary.coupon}}`, `{{summary.membershipDiscount}}`, `{{summary.serviceCharge}}`, `{{summary.deliveryCharge}}`, `{{summary.packagingFee}}`, `{{summary.tax}}`, `{{summary.rounding}}`, `{{summary.grandTotal}}`

**Payment fields:** `{{payment.method}}`, `{{payment.paidAmount}}`, `{{payment.change}}`, `{{payment.approvalCode}}`, `{{payment.qrReference}}`, `{{payment.cardNumber}}`

#### FR-04: Component Library

Non-data visual components:

| Component | Properties |
|-----------|------------|
| **Horizontal Divider** | thickness, color, margin, style (solid/dashed/dotted) |
| **Blank Space** | height |
| **Text** | content, font size, weight, alignment, color |
| **Image** | src (from store assets or URL), width, height, alignment |
| **QR Code** | data (from variable or static), size, error correction |
| **Barcode** | data, format (code128, ean13), height, showLabel |
| **Line Separator** | thickness, color, dash pattern |

#### FR-05: Properties Panel

When a component is selected, show:

**Layout tab:**
- Margin (top, right, bottom, left)
- Padding (top, right, bottom, left)
- Width (auto / fixed / percentage)
- Height (auto / fixed)
- Horizontal Alignment (left, center, right)
- Vertical Alignment (top, middle, bottom)

**Typography tab** (text components only):
- Font Size (px)
- Font Weight (normal, bold, bolder)
- Font Style (normal, italic)
- Text Align (left, center, right)
- Text Transform (none, uppercase, lowercase, capitalize)

**Style tab:**
- Text Color
- Background Color
- Border (width, color, radius)

**Visibility tab:**
- Always visible
- Conditional visibility (see FR-06)

#### FR-06: Conditional Visibility

Each component can have visibility rules. A component is rendered only when all conditions evaluate to true.

**Condition operators:**
- `equals` — `{{payment.method}} equals "QRIS"`
- `not_equals` — `{{customer.memberNumber}} not_equals ""`
- `greater_than` — `{{summary.serviceCharge}} greater_than 0`
- `less_than` — `{{summary.grandTotal}} less_than 10000`
- `exists` — `{{promotion}} exists`
- `not_exists` — `{{customer}} not_exists`

**Examples:**
```text
Show "QRIS instructions" only if → payment.method equals "QRIS"
Show "Member point" only if       → customer.memberNumber exists
Show "Change amount" only if      → payment.change greater_than 0
Show "Service Charge" only if     → summary.serviceCharge greater_than 0
Hide "Manual Discount" if         → summary.orderDiscount equals 0
```

Conditions use AND logic. Multiple conditions = all must be true.

#### FR-07: Canvas

- **Paper Presets:** Thermal 58mm, Thermal 80mm, A4 Portrait, A4 Landscape
- **Live Preview:** Updates in real-time as user edits
- **Sample Data:** Switch between Cafe, Retail, Restaurant, Laundry, Salon presets
- **Zoom:** 50% / 75% / 100% / 150% / Fit Width
- **Snap to Grid:** Configurable grid spacing (5px / 10px / 20px)
- **Ruler:** Horizontal ruler at top, vertical ruler at left
- **Margin Guide:** Dashed lines showing print margin boundaries
- **Drop Zone:** Visual highlights when dragging over valid drop areas

#### FR-08: Template Management

| Operation | Description |
|-----------|-------------|
| **Create** | New blank template or from preset |
| **Save Draft** | Auto-save every 30s + manual save |
| **Publish** | Promote draft to active version |
| **Duplicate** | Clone template with new name |
| **Export JSON** | Download template as `.kuire-template.json` |
| **Import JSON** | Upload and validate template file |
| **Version History** | Timeline of all saves with diff view |
| **Rollback** | Restore any previous version |
| **Delete** | Soft-delete with confirmation |

#### FR-09: Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Delete` / `Backspace` | Remove selected component |
| `Ctrl+C` | Copy selected component |
| `Ctrl+V` | Paste component |
| `Ctrl+D` | Duplicate component |
| `Ctrl+S` | Save draft |
| `Ctrl+P` | Publish |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Reset zoom to 100% |
| `Ctrl+Click` | Multi-select |
| `Arrow keys` | Nudge selected component 1px |

#### FR-10: Empty State

When a new template is created with no content:

- Show a centered instructional overlay
- "Drag sections from the Toolbox to start building your receipt"
- Quick-start buttons: "Use Default Template", "Start Blank", "Import Template"

---

## 6. Non-Functional Requirements

### NFR-01: Performance

| Metric | Target |
|--------|--------|
| Canvas render response | < 100ms after drag |
| Template load time | < 500ms (100+ components) |
| JSON serialisation | < 200ms |
| Auto-save debounce | 30s after last change |
| Preview generation | < 50ms after data change |

### NFR-02: Compatibility

- Supports Chrome, Firefox, Safari, Edge (last 2 major versions)
- Supports ESC/POS thermal printers (58mm, 80mm)
- Supports A4 laser/inkjet printing (PDF via browser print)
- Template JSON schema is versioned (`schemaVersion` field)
- Backward compatible: v1 templates render identically after engine upgrade

### NFR-03: Security

- Template JSON is sanitised on import (no script injection)
- Image URLs validated against allowed domains
- Field variable injection is read-only — no mutation of receipt data
- Version history retains last 50 versions per template

### NFR-04: Maintainability

- `@kuire/document-engine` is a standalone package with zero UI dependency
- `@kuire/template-designer` imports engine for preview only
- New field types require adding to FieldRegistry — no core changes
- New document types require only a paper preset + field filter config

---

## 7. System Architecture

### 7.1 Package Structure

```
kuire/
│
├── packages/
│   │
│   ├── document-engine/               # Core engine (zero UI dependency)
│   │   ├── src/
│   │   │   ├── types/                 #   All type definitions
│   │   │   │   ├── template.ts        #     Template schema, Section, Component
│   │   │   │   ├── receipt-model.ts   #     Receipt data model
│   │   │   │   ├── paper.ts           #     Paper presets (58mm, 80mm, A4)
│   │   │   │   ├── fields.ts          #     Field definitions and registry
│   │   │   │   └── conditions.ts      #     Visibility condition types
│   │   │   ├── renderer/              #   Renders template + data → output
│   │   │   │   ├── DocumentRenderer.ts #     Orchestrator
│   │   │   │   ├── thermal/           #     ESC/POS layout calculator
│   │   │   │   ├── pdf/               #     PDF layout calculator
│   │   │   │   └── canvas/            #     HTML canvas renderer (preview)
│   │   │   ├── engine/                #   Template evaluation logic
│   │   │   │   ├── TemplateEngine.ts   #     Load, validate, resolve variables
│   │   │   │   ├── ConditionEvaluator.ts
│   │   │   │   ├── VariableResolver.ts
│   │   │   │   └── SectionSorter.ts
│   │   │   ├── registry/              #   Plugin-style registries
│   │   │   │   ├── FieldRegistry.ts
│   │   │   │   ├── ComponentRegistry.ts
│   │   │   │   └── PaperRegistry.ts
│   │   │   ├── validation/            #   Template schema validation
│   │   │   │   └── TemplateValidator.ts
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   └── package.json
│   │
│   ├── template-designer/             # React UI for template editing
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── layout/
│   │   │   │   │   ├── DesignerLayout.tsx       # 3-panel shell
│   │   │   │   │   ├── ToolboxPanel.tsx
│   │   │   │   │   ├── CanvasPanel.tsx
│   │   │   │   │   └── PropertiesPanel.tsx
│   │   │   │   ├── toolbox/
│   │   │   │   │   ├── SectionLibrary.tsx
│   │   │   │   │   ├── FieldLibrary.tsx
│   │   │   │   │   ├── ComponentLibrary.tsx
│   │   │   │   │   └── LibraryItem.tsx
│   │   │   │   ├── canvas/
│   │   │   │   │   ├── DocumentCanvas.tsx       # DnD zone
│   │   │   │   │   ├── CanvasSection.tsx
│   │   │   │   │   ├── CanvasComponent.tsx
│   │   │   │   │   ├── SnapGrid.tsx
│   │   │   │   │   ├── Ruler.tsx
│   │   │   │   │   └── MarginGuide.tsx
│   │   │   │   ├── properties/
│   │   │   │   │   ├── PropertiesPanel.tsx
│   │   │   │   │   ├── LayoutProperties.tsx
│   │   │   │   │   ├── TypographyProperties.tsx
│   │   │   │   │   ├── StyleProperties.tsx
│   │   │   │   │   └── VisibilityProperties.tsx
│   │   │   │   ├── preview/
│   │   │   │   │   ├── LivePreview.tsx
│   │   │   │   │   ├── SampleDataSelector.tsx
│   │   │   │   │   └── PaperPresetSelector.tsx
│   │   │   │   ├── toolbar/
│   │   │   │   │   ├── DesignerToolbar.tsx
│   │   │   │   │   ├── UndoRedoToolbar.tsx
│   │   │   │   │   └── ZoomControls.tsx
│   │   │   │   └── shared/
│   │   │   │       ├── DragOverlay.tsx
│   │   │   │       ├── EmptyState.tsx
│   │   │   │       └── KeyboardShortcutHint.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useDragDrop.ts
│   │   │   │   ├── useUndoRedo.ts
│   │   │   │   ├── useAutoSave.ts
│   │   │   │   ├── useZoom.ts
│   │   │   │   ├── useSnapToGrid.ts
│   │   │   │   └── useKeyboardShortcuts.ts
│   │   │   ├── store/
│   │   │   │   ├── designerStore.ts             # Zustand: template state
│   │   │   │   └── uiStore.ts                   # UI state (zoom, grid, selection)
│   │   │   ├── services/
│   │   │   │   ├── templateApi.ts
│   │   │   │   └── sampleDataService.ts
│   │   │   ├── utils/
│   │   │   │   ├── grid.ts
│   │   │   │   ├── ruler.ts
│   │   │   │   └── paper.ts
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   └── package.json
│   │
│   ├── receipt-model/                  # Shared data model for all documents
│   │   └── src/
│   │       ├── types.ts
│   │       └── index.ts
│   │
│   └── print-service/                  # Existing — sends rendered output to printer
│       └── src/
│           ├── adapters/
│           │   ├── ThermalPrinter.ts    #     ESC/POS
│           │   ├── PdfPrinter.ts
│           │   └── LabelPrinter.ts
│           └── index.ts
│
├── apps/
│   ├── admin/                          # Dashboard — hosts template designer page
│   └── pos/                            # POS terminal — uses published templates
│
└── docs/
    └── receipt-designer/               # This spec
```

### 7.2 Data Flow

```
┌──────────────┐      ┌──────────────────────┐      ┌──────────────────┐
│  Designer UI │      │   Document Engine     │      │   Print Service   │
│  (React)     │ ───► │  (TypeScript)         │ ───► │  (Node.js)        │
│              │      │                      │      │                   │
│  Template    │      │  Renderer.resolve(   │      │  ThermalPrinter   │
│  JSON        │      │    template, data    │      │  PdfPrinter       │
│              │      │  ) → Layout          │      │  LabelPrinter     │
└──────────────┘      └──────────────────────┘      └──────────────────┘
        │                       ▲
        │                       │
        ▼                       │
┌───────────────────────────────────────┐
│           Receipt Model               │
│  (shared type definitions)            │
│                                       │
│  { store, order, customer, items,     │
│    summary, payment, adjustments }     │
└───────────────────────────────────────┘
```

**Flow for POS print:**
1. POS completes transaction → builds ReceiptModel from order data
2. POS invokes DocumentEngine with (active template, receipt model, paper type)
3. Engine evaluates conditions, resolves variables, produces a `Layout` object
4. Layout is passed to PrintService adapter (thermal, PDF, etc.)
5. Printer adapter renders final output

**Flow for Designer preview:**
1. User edits template in Designer UI
2. Designer UI calls DocumentEngine.renderPreview(template, sampleData)
3. Engine produces Layout → rendered to HTML Canvas for preview
4. Any edit re-triggers preview (debounced 200ms)

### 7.3 Engine Architecture (Document Engine)

```
TemplateEngine
│
├── load(json)                         # Parse + validate template JSON
├── resolve(template, data) → Layout   # Main entry point
│   │
│   ├── SectionSorter.sort(sections)   # Order sections by position
│   ├── ConditionEvaluator.evaluate()  # Check visibility for each component
│   ├── VariableResolver.resolve()     # Replace {{path}} with actual data
│   └── LayoutAssembler.assemble()     # Calculate positions, build Layout
│
├── renderPreview(template, data)      # Same as resolve but returns canvas-ready
└── validate(template) → ValidationResult
```

### 7.4 Layout Output

The engine produces a platform-agnostic Layout that any renderer can consume:

```typescript
interface Layout {
  paper: PaperPreset;
  pages: Page[];
}

interface Page {
  width: number;        // mm
  height: number;       // mm (auto-grow for thermal)
  sections: LayoutSection[];
}

interface LayoutSection {
  id: string;
  components: LayoutComponent[];
}

interface LayoutComponent {
  type: string;
  x: number;            // mm from left
  y: number;            // mm from top
  width: number;        // mm
  height: number;       // mm (auto for text)
  content: string;      // resolved text content
  style: ComponentStyle;
  children?: LayoutComponent[];  // for nested structures (item rows)
}
```

---

## 8. Data Model

### 8.1 Template Schema

```typescript
// packages/document-engine/src/types/template.ts

interface Template {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  schemaVersion: number;              // For backward compat
  documentType: DocumentType;         // 'receipt' | 'invoice' | 'kot' | 'label' | 'report'
  paper: PaperPreset;
  sections: TemplateSection[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    publishedAt?: string;
    version: number;
    createdBy: string;
    tags?: string[];
  };
}

interface PaperPreset {
  type: PaperType;                    // 'thermal58' | 'thermal80' | 'a4-portrait' | 'a4-landscape'
  width: number;                      // mm
  height: number | 'auto';           // 'auto' for roll paper
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

type DocumentType = 'receipt' | 'invoice' | 'kot' | 'label' | 'report' | 'slip';
type PaperType = 'thermal58' | 'thermal80' | 'a4-portrait' | 'a4-landscape';

interface TemplateSection {
  id: string;
  type: SectionType;
  enabled: boolean;
  position: number;                   // Sort order
  components: SectionComponent[];
}

type SectionType =
  | 'header'
  | 'store_info'
  | 'order_info'
  | 'customer_info'
  | 'items'
  | 'item_modifiers'
  | 'item_adjustments'
  | 'summary'
  | 'payment'
  | 'tax_detail'
  | 'footer'
  | 'qrcode'
  | 'barcode';

interface SectionComponent {
  id: string;                         // Unique within template
  type: ComponentType;
  field?: string;                     // Variable path, e.g. "store.name"
  label?: string;                     // Override display label
  style: ComponentStyle;
  visibility: VisibilityRule[];
  position: {
    x: number;                        // mm from section left
    y: number;                        // mm from section top
    width: ComponentDimension;
    height: ComponentDimension;
  };
}

type ComponentType =
  | 'field'                           // Data field from receipt model
  | 'text'                            // Static text
  | 'image'                           // Logo, photo
  | 'divider'                         // Horizontal line
  | 'spacer'                          // Blank space
  | 'qrcode'                          // QR Code
  | 'barcode'                         // Barcode
  | 'line_separator';                 // Dashed/dotted line

type ComponentDimension =
  | { unit: 'auto' }
  | { unit: 'mm'; value: number }
  | { unit: 'percent'; value: number };

interface ComponentStyle {
  margin?: BoxEdges;
  padding?: BoxEdges;
  font?: {
    size?: number;                    // pt
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

interface BoxEdges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface VisibilityRule {
  field: string;                      // Variable path to check
  operator: VisibilityOperator;
  value?: string | number | boolean;
}

type VisibilityOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'exists'
  | 'not_exists';
```

### 8.2 Receipt Model (Document Data Source)

```typescript
// packages/receipt-model/src/types.ts

interface ReceiptModel {
  schemaVersion: number;

  store: {
    logo?: string;                    // URL or base64
    name: string;
    address: string;
    phone?: string;
    email?: string;
    website?: string;
    taxNumber?: string;
    merchantId?: string;
  };

  order: {
    invoiceNumber: string;
    orderNumber: string;
    type: 'dine_in' | 'takeaway' | 'delivery' | 'online';
    table?: string;
    queueNumber?: string;
    cashier: string;
    shift?: string;
    date: string;                     // ISO date
    time: string;                     // HH:mm
    notes?: string;
  };

  customer?: {
    name?: string;
    memberNumber?: string;
    phone?: string;
    email?: string;
    company?: string;
    taxId?: string;
  };

  items: ReceiptItem[];

  summary: {
    subtotal: number;
    orderDiscount?: number;
    voucher?: number;
    coupon?: number;
    membershipDiscount?: number;
    serviceCharge?: number;
    deliveryCharge?: number;
    packagingFee?: number;
    tax: number;
    rounding: number;
    grandTotal: number;
  };

  payment: {
    method: string;
    paidAmount: number;
    change: number;
    approvalCode?: string;
    qrReference?: string;
    cardNumber?: string;              // Masked
  };

  adjustments?: LineAdjustment[];     // All adjustments applied
  promotions?: AppliedPromotion[];
}

interface ReceiptItem {
  name: string;
  sku?: string;
  barcode?: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  note?: string;
  modifiers?: ItemModifier[];
  adjustments?: LineAdjustment[];     // Per-item adjustments from pricing engine
}

interface ItemModifier {
  name: string;
  price: number;
}

interface LineAdjustment {
  name: string;                       // "Coffee Promo 30%", "Happy Hour"
  type: 'promotion' | 'discount' | 'charge';
  amount: number;                     // Negative for discounts, positive for charges
}

interface AppliedPromotion {
  name: string;
  code?: string;
  discount: number;
}
```

### 8.3 Template Version Schema

```typescript
interface TemplateVersion {
  id: string;
  templateId: string;
  version: number;
  template: Template;                 // Full snapshot
  changeDescription?: string;
  createdBy: string;
  createdAt: string;
  status: 'draft' | 'published';
}
```

### 8.4 JSON Template Example (Minimal)

```json
{
  "id": "tpl-001",
  "tenantId": "tenant-abc",
  "name": "Default Thermal 80mm",
  "schemaVersion": 1,
  "documentType": "receipt",
  "paper": {
    "type": "thermal80",
    "width": 80,
    "height": "auto",
    "margin": { "top": 2, "right": 3, "bottom": 2, "left": 3 }
  },
  "sections": [
    {
      "id": "header",
      "type": "header",
      "enabled": true,
      "position": 1,
      "components": [
        {
          "id": "comp-001",
          "type": "image",
          "field": "store.logo",
          "style": { "font": { "align": "center" } },
          "visibility": [],
          "position": {
            "x": 0, "y": 0,
            "width": { "unit": "auto" },
            "height": { "unit": "mm", "value": 12 }
          }
        },
        {
          "id": "comp-002",
          "type": "field",
          "field": "store.name",
          "label": null,
          "style": {
            "font": { "size": 14, "weight": "bold", "align": "center" }
          },
          "visibility": [],
          "position": {
            "x": 0, "y": 14,
            "width": { "unit": "auto" },
            "height": { "unit": "auto" }
          }
        },
        {
          "id": "comp-003",
          "type": "divider",
          "style": { "border": { "width": 1, "color": "#000000", "radius": 0, "style": "solid" } },
          "visibility": [],
          "position": {
            "x": 0, "y": 20,
            "width": { "unit": "percent", "value": 100 },
            "height": { "unit": "auto" }
          }
        }
      ]
    },
    {
      "id": "items",
      "type": "items",
      "enabled": true,
      "position": 2,
      "components": [
        {
          "id": "comp-004",
          "type": "field",
          "field": "item.name",
          "style": { "font": { "size": 10, "weight": "bold" } },
          "visibility": [],
          "position": {
            "x": 0, "y": 0,
            "width": { "unit": "percent", "value": 50 },
            "height": { "unit": "auto" }
          }
        }
      ]
    },
    {
      "id": "summary",
      "type": "summary",
      "enabled": true,
      "position": 3,
      "components": [
        {
          "id": "comp-005",
          "type": "field",
          "field": "summary.subtotal",
          "label": "Subtotal",
          "style": {},
          "visibility": [],
          "position": {
            "x": 0, "y": 0,
            "width": { "unit": "auto" },
            "height": { "unit": "auto" }
          }
        },
        {
          "id": "comp-006",
          "type": "field",
          "field": "summary.grandTotal",
          "label": "Total",
          "style": { "font": { "size": 14, "weight": "bold" } },
          "visibility": [],
          "position": {
            "x": 0, "y": 6,
            "width": { "unit": "auto" },
            "height": { "unit": "auto" }
          }
        }
      ]
    }
  ],
  "metadata": {
    "createdAt": "2026-07-29T10:00:00Z",
    "updatedAt": "2026-07-29T10:00:00Z",
    "version": 1,
    "createdBy": "user-001"
  }
}
```

---

## 9. Component Tree

```text
<DesignerLayout>
│
├── <DesignerToolbar>
│   ├── <TemplateTitle>                    (editable)
│   ├── <TemplateActions>                  Save, Publish, Duplicate, Export
│   ├── <UndoRedoToolbar>                  Undo, Redo, History
│   ├── <PaperPresetSelector>              58mm / 80mm / A4
│   ├── <ZoomControls>                     +/- / Fit / 100%
│   └── <SampleDataSelector>               Cafe / Retail / Restaurant
│
├── <ToolboxPanel>
│   ├── <Accordion sections>
│   │   └── <SectionLibrary>
│   │       └── <LibraryItem>[]            Draggable section items
│   ├── <Accordion fields>
│   │   └── <FieldLibrary>
│   │       └── <FieldGroup>               Store, Order, Customer, Item, etc.
│   │           └── <LibraryItem>[]        Draggable field items
│   └── <Accordion components>
│       └── <ComponentLibrary>
│           └── <LibraryItem>[]            Draggable component items
│
├── <CanvasPanel>
│   ├── <Ruler orientation="horizontal" />
│   ├── <Ruler orientation="vertical" />
│   ├── <DocumentCanvas>                   (DnD context)
│   │   ├── <SnapGrid />                   (visual grid overlay)
│   │   ├── <MarginGuide />                (dashed print margin)
│   │   ├── <EmptyState />                 (when no content)
│   │   └── <CanvasSection>[]
│   │       ├── <SectionHeader>            (drag handle, toggle, label)
│   │       └── <CanvasComponent>[]
│   │           ├── (resize handles)
│   │           └── (component preview)
│   └── <DragOverlay />                    (of DnD kit)
│
├── <PropertiesPanel>
│   └── (conditional on selection)
│       ├── <EmptyProperties />            (nothing selected)
│       └── (component selected)
│           ├── <SectionProperties>        (for section)
│           │   └── Enable toggle, reorder
│           └── <ComponentProperties>      (for component)
│               ├── <LayoutProperties />
│               ├── <TypographyProperties />
│               ├── <StyleProperties />
│               └── <VisibilityProperties />
│
└── <LivePreview>                          (floating modal or side-by-side)
    ├── <PreviewFrame />                   (simulated paper)
    └── <SampleDataIndicator />            (which sample is loaded)
```

---

## 10. API Design

### 10.1 REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/templates` | List templates (filter by documentType, tenant) |
| `POST` | `/api/templates` | Create template |
| `GET` | `/api/templates/:id` | Get template detail (latest published or specific version) |
| `PUT` | `/api/templates/:id` | Update template (creates new draft version) |
| `DELETE` | `/api/templates/:id` | Soft-delete template |
| `POST` | `/api/templates/:id/duplicate` | Duplicate template |
| `POST` | `/api/templates/:id/publish` | Publish current draft |
| `GET` | `/api/templates/:id/versions` | List version history |
| `GET` | `/api/templates/:id/versions/:versionId` | Get specific version |
| `POST` | `/api/templates/:id/rollback/:versionId` | Rollback to version |
| `POST` | `/api/templates/:id/export` | Export template as JSON |
| `POST` | `/api/templates/import` | Import template from JSON |

### 10.2 Engine API (Server-side, called by Print Service)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/render` | Render template + data → Layout JSON |
| `POST` | `/api/render/preview` | Render for preview (includes bounding boxes) |
| `POST` | `/api/render/validate` | Validate template against receipt model |

### 10.3 Request/Response Examples

**POST /api/render**

```json
{
  "template": { /* Template JSON */ },
  "data": { /* ReceiptModel */ },
  "output": "thermal80"
}
```

**Response 200:**
```json
{
  "layout": {
    "paper": { "width": 80, "height": 240 },
    "pages": [
      {
        "sections": [
          {
            "id": "header",
            "components": [
              {
                "type": "image",
                "x": 30, "y": 2, "width": 20, "height": 12,
                "content": "data:image/...",
                "style": {}
              },
              {
                "type": "text",
                "x": 0, "y": 16, "width": 74, "height": 5,
                "content": "Warung Kopi Kuire",
                "style": { "font": { "size": 14, "weight": "bold", "align": "center" } }
              }
            ]
          }
        ]
      }
    ]
  }
}
```

---

## 11. UI/UX Specification

### 11.1 Design Principles

1. **Familiar paradigm**: Users who know Canva, Figma, or Wix will feel at home
2. **Direct manipulation**: Drag, drop, resize, reorder — all visual
3. **Immediate feedback**: Every change reflects in preview instantly
4. **Progressive disclosure**: Basic customisation visible first; advanced properties in panels
5. **Error prevention**: Drop zones highlight, invalid positions blocked, template validation on save
6. **Mobile-first not required**: Designer is desktop-only (Tablet minimum 1024px)

### 11.2 Visual Design Tokens

```json
{
  "designer": {
    "backgroundColor": "#F8F9FA",
    "toolbox": { "width": 280, "backgroundColor": "#FFFFFF", "borderRight": true },
    "properties": { "width": 320, "backgroundColor": "#FFFFFF", "borderLeft": true },
    "canvas": { "backgroundColor": "#E8ECF0" },
    "dropIndicator": { "color": "#2176D2", "thickness": 2, "style": "dashed" },
    "grid": { "color": "#E0E0E0", "spacing": 10 },
    "ruler": { "backgroundColor": "#F0F0F0", "textColor": "#999", "size": 24 },
    "margin": { "color": "#FF6B6B", "opacity": 0.3 },
    "selected": { "borderColor": "#2176D2", "handleSize": 8 }
  }
}
```

### 11.3 Empty State

When a new template is created:

- Canvas shows a centred illustration (document with dashed lines)
- Text: "Mulai mendesain template Anda"
- Subtitle: "Seret section atau field dari panel kiri ke area ini"
- Three quick-action buttons:
  - "Gunakan Template Default" (loads standard receipt template)
  - "Mulai Kosong" (clears all sections)
  - "Import Template" (opens file picker for `.kuire-template.json`)

### 11.4 Drag & Drop Behaviour

| Action | Behaviour |
|--------|-----------|
| Drag section from toolbox | Inserts section at drop position; shows insertion line indicator |
| Drag field from toolbox | Inserts component into the nearest section; auto-positions at end |
| Reorder section | Drag section header up/down; ripple animation for target position |
| Reorder component within section | Drag component; shows snap position guides |
| Resize component | 8 handles (4 corners + 4 midpoints); snap to grid |
| Remove component | Drag outside canvas OR press Delete key |
| Copy component | Ctrl+C / Ctrl+D; pasted slightly offset from original |

### 11.5 Mouse & Touch

| Interaction | Desktop | Touch (tablet) |
|-------------|---------|----------------|
| Select | Click | Tap |
| Drag | Pointer down + move | Touch + hold (300ms) + drag |
| Resize | Drag handle | Drag handle (min 44px touch target) |
| Context menu | Right-click | Long-press |
| Multi-select | Ctrl+Click | Not supported |

### 11.6 Responsive Behaviour

| Breakpoint | Layout |
|------------|--------|
| > 1400px | Full 3-panel: toolbox (280) | canvas (flex) | properties (320) |
| 1024–1400px | Collapsible toolbox (icon bar) | canvas (flex) | properties (320) |
| < 1024px | Not supported (show upgrade message) |

### 11.7 Loading & Error States

| State | Behaviour |
|-------|-----------|
| Loading template | Skeleton placeholder matching 3-panel layout |
| Saving draft | Subtle "Saving..." indicator in toolbar (green "Saved" when done) |
| Auto-save error | Warning toast "Auto-save gagal. Coba simpan manual." |
| Publish error | Error modal with details + "Coba Lagi" button |
| Template not found | Full-page "Template tidak ditemukan" with "Kembali ke Daftar" button |
| Import invalid JSON | Modal showing validation errors line by line |

---

## 12. Engine API Reference

### 12.1 `TemplateEngine`

```typescript
class TemplateEngine {
  constructor(registries: {
    fields: FieldRegistry;
    components: ComponentRegistry;
    papers: PaperRegistry;
  });

  // Load and validate a template
  load(json: unknown): Template;

  // Full resolve: evaluate conditions, resolve variables, calculate layout
  resolve(template: Template, data: ReceiptModel): Layout;

  // Preview (includes debug info for canvas rendering)
  renderPreview(template: Template, data: ReceiptModel): PreviewLayout;

  // Validate only (no rendering)
  validate(template: unknown): ValidationResult;

  // Get all available fields for a given document type
  getAvailableFields(documentType: DocumentType): FieldDefinition[];

  // Get paper presets
  getPaperPresets(): PaperPreset[];
}
```

### 12.2 `FieldRegistry`

```typescript
class FieldRegistry {
  register(field: FieldDefinition): void;
  get(path: string): FieldDefinition | undefined;
  getAll(documentType?: DocumentType): FieldDefinition[];
  remove(path: string): void;
}

interface FieldDefinition {
  path: string;                         // "store.name"
  type: 'string' | 'number' | 'image' | 'boolean';
  label: string;                        // "Store Name"
  section: SectionType;                 // Which section provides this field
  documentTypes: DocumentType[];        // Available in which documents
  sampleValue: unknown;                 // For preview
}
```

### 12.3 `ConditionEvaluator`

```typescript
class ConditionEvaluator {
  evaluate(
    rules: VisibilityRule[],
    data: ReceiptModel
  ): boolean;
}
```

Evaluation logic:
1. If `rules` is empty → always visible (`true`)
2. All rules must pass (AND logic)
3. For `equals` / `not_equals`: resolve `field` path, compare with `value`
4. For `exists`: resolve `field` path, check not null/undefined/empty string
5. For `greater_than` / `less_than`: numeric comparison

### 12.4 `VariableResolver`

```typescript
class VariableResolver {
  resolve(
    template: Template,
    data: ReceiptModel
  ): ResolvedTemplate;
}
```

Resolution logic:
1. Walk template sections → components
2. For every `field` value matching `{{path}}`: resolve against ReceiptModel
3. If path not found → render as `""` (silent fail)
4. For item-level fields (`{{item.*}}`): duplicate component per item row
5. For adjustment fields (`{{adjustment.*}}`): duplicate component per adjustment

### 12.5 Extending with New Field Types

```typescript
// In any app/module that wants to add fields:
import { FieldRegistry } from '@kuire/document-engine';

FieldRegistry.getInstance().register({
  path: 'loyalty.points',
  type: 'number',
  label: 'Loyalty Points',
  section: 'summary',
  documentTypes: ['receipt', 'invoice'],
  sampleValue: 150,
});
```

---

## 13. Implementation Phases

### Phase 1: Core Engine & Data Model (Week 1-2) ✅ COMPLETE

- [x] Set up `packages/document-engine` with TypeScript, Vitest
- [x] Define all types: `Template`, `SectionComponent`, `ReceiptModel`, `PaperPreset`, `Layout`
- [x] Implement `TemplateValidator` (Zod schema, version check)
- [x] Implement `VariableResolver` (path resolution, item iteration, expression evaluation, formatters)
- [x] Implement `ConditionEvaluator` (all operators)
- [x] Implement `SectionSorter`
- [x] Implement `FieldRegistry`, `ComponentRegistry`, `PaperRegistry`
- [x] Implement `TemplateEngine.resolve()` — full pipeline
- [x] Implement thermal layout calculator (58mm, 80mm)
- [x] Write tests: 99 unit tests covering all engine paths (expression, formatters, variable resolver, thermal layout, template engine, registries, defaults, etc.)
- ✅ `receipt-model` → now `DocumentData` in `document-engine/types`

**Deliverable:** `@kuire/document-engine` — backend-ready, Node.js testable ✅

### Phase 2: Template CRUD API (Week 3) ✅ COMPLETE

- [x] Create `Template` Mongoose schema (MongoDB)
- [x] Create `TemplateVersion` schema
- [x] Implement `TemplateService` (CRUD + versioning + publish/rollback)
- [x] Implement `TemplateController` + routes
- [x] Implement export/import with validation
- [x] Seed default templates (58mm, 80mm, KOT, Invoice A4)
- [x] Write integration/API tests (16 tests)

**Deliverable:** Full REST API for template management ✅

### Phase 3: Designer UI — Canvas & Toolbox (Week 4-5) ✅ COMPLETE (Frontend)

- [x] Set up `template-designer` as React module (Vite + React Router)
- [x] Implement `DesignerLayout` (3-panel shell with resizable dividers)
- [x] Implement `ToolboxPanel` with tabs (Sections/Fields/Components)
- [x] Implement `SectionLibrary`, `FieldLibrary`, `ComponentLibrary`
- [x] Implement drag source for toolbox items (HTML5 Drag & Drop API)
- [x] Implement `CanvasPanel` with drop zone + snap grid + zoom
- [x] Implement `CanvasSection` + `CanvasComponent` rendering
- [x] Implement `EmptyState` for blank templates

**Deliverable:** Functional drag-and-drop canvas, items can be dragged from toolbox to canvas ✅

### Phase 4: Designer UI — Properties & Preview ✅ COMPLETE (Frontend)

- [x] Implement `PropertiesPanel` with dynamic form (font, align, transform, field path, label, format)
- [x] Implement `LivePreview` using Document Engine (REST API call to `/api/render/preview`)
- [x] Implement `PaperPresetSelector` (58mm, 80mm, A4)
- [x] Integrate preview with engine — preview modal with sample data

**Deliverable:** Full property editing + live preview ✅

### Phase 5: Designer UI — Toolbar & Polish ❌ NEXT

- [ ] Implement `UndoRedo` (Zustand middleware + keyboard shortcuts)
- [ ] Implement `AutoSave` (30s debounce + on-blur)
- [ ] Implement `ZoomControls` (50%–150% + Fit Width)
- [ ] Implement keyboard shortcuts
- [ ] Implement selection (click, multi-select, click-outside to deselect)
- [ ] Implement resize handles with snap
- [ ] Implement copy/paste/duplicate/delete
- [ ] Implement `DesignerToolbar` (all actions)
- [ ] Implement loading states, error states, empty states
- [ ] Responsive breakpoints

**Deliverable:** Polished designer UI with all interactions (in progress — toolbar exists)

### Phase 6: Print Integration ✅ COMPLETE

- [x] Implement `ThermalRenderer` (ESC/POS commands from Layout)
- [x] Implement `PdfRenderer` (using `pdfkit`)
- [x] Wire POS terminal to use published template + engine for receipt printing
- [x] Wire dashboard reports to use A4 templates
- [x] End-to-end test: design → publish → preview → print

**Deliverable:** Templates are printable from POS and dashboard ✅

---

## 14. Glossary

| Term | Definition |
|------|------------|
| **Template** | A JSON document describing the layout of a printed document |
| **Section** | A logical grouping of components (e.g., Header, Items, Summary) |
| **Component** | A single visual element (field, text, image, divider, etc.) |
| **Field** | A component that displays data from the Receipt Model (e.g., `{{store.name}}`) |
| **Canvas** | The visual editing area where templates are designed |
| **Toolbox** | The left panel containing draggable sections, fields, and components |
| **Properties Panel** | The right panel showing editable properties of the selected component |
| **Paper Preset** | Physical paper dimensions (thermal 58mm, 80mm, A4, etc.) |
| **Receipt Model** | The shared data structure containing all document variables |
| **Conditional Visibility** | Rules that determine whether a component appears based on data |
| **Document Engine** | The core rendering engine that converts templates + data into layouts |
| **Layout** | Platform-agnostic output of the engine (positioned components with resolved content) |
| **ESC/POS** | Industry standard command protocol for thermal receipt printers |
| **DnD** | Drag and Drop |

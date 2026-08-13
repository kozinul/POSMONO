import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { PrinterId } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';

export type PrinterConnectionType = 'network' | 'usb' | 'bluetooth';
export type PrinterPurpose = 'receipt' | 'kot';
export type PrinterPaperSize = 'thermal58' | 'thermal80' | 'a4-portrait';

export interface IPrinter {
  id: string;
  tenantId: string;
  name: string;
  connectionType: PrinterConnectionType;
  ip: string;
  port: number;
  paperSize: PrinterPaperSize;
  purpose: PrinterPurpose;
  copies: number;
  isDefault: boolean;
  enabled: boolean;
  bluetoothName: string;
  usbVendorId: string;
  usbProductId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PrinterProps = Omit<IPrinter, 'id' | 'createdAt' | 'updatedAt'>;

export class Printer extends AggregateRoot<PrinterId> {
  private tenantId: string;
  private name: string;
  private connectionType: PrinterConnectionType;
  private ip: string;
  private port: number;
  private paperSize: PrinterPaperSize;
  private purpose: PrinterPurpose;
  private copies: number;
  private isDefault: boolean;
  private enabled: boolean;
  private bluetoothName: string;
  private usbVendorId: string;
  private usbProductId: string;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IPrinter) {
    super(new PrinterId(props.id));
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.connectionType = props.connectionType;
    this.ip = props.ip;
    this.port = props.port;
    this.paperSize = props.paperSize;
    this.purpose = props.purpose;
    this.copies = props.copies;
    this.isDefault = props.isDefault;
    this.enabled = props.enabled;
    this.bluetoothName = props.bluetoothName;
    this.usbVendorId = props.usbVendorId;
    this.usbProductId = props.usbProductId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: PrinterProps): Printer {
    const printer = new Printer({
      ...props,
      id: new PrinterId().toValue(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    printer.addDomainEvent(
      new DomainEvent({
        eventName: 'printer.created',
        aggregateId: printer.id.toValue(),
        aggregateType: 'Printer',
        tenantId: printer.tenantId,
        payload: { printerId: printer.id.toValue(), name: printer.name, purpose: printer.purpose },
      }),
    );

    return printer;
  }

  static hydrate(props: IPrinter): Printer {
    return new Printer(props);
  }

  update(props: Partial<PrinterProps>): void {
    if (props.name !== undefined) this.name = props.name;
    if (props.connectionType !== undefined) this.connectionType = props.connectionType;
    if (props.ip !== undefined) this.ip = props.ip;
    if (props.port !== undefined) this.port = props.port;
    if (props.paperSize !== undefined) this.paperSize = props.paperSize;
    if (props.purpose !== undefined) this.purpose = props.purpose;
    if (props.copies !== undefined) this.copies = props.copies;
    if (props.isDefault !== undefined) this.isDefault = props.isDefault;
    if (props.enabled !== undefined) this.enabled = props.enabled;
    if (props.bluetoothName !== undefined) this.bluetoothName = props.bluetoothName;
    if (props.usbVendorId !== undefined) this.usbVendorId = props.usbVendorId;
    if (props.usbProductId !== undefined) this.usbProductId = props.usbProductId;
    this.updatedAt = new Date();
  }

  get connection(): PrinterConnectionType {
    return this.connectionType;
  }

  get targetPurpose(): PrinterPurpose {
    return this.purpose;
  }

  get isNetwork(): boolean {
    return this.connectionType === 'network';
  }

  serialize(): IPrinter {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      name: this.name,
      connectionType: this.connectionType,
      ip: this.ip,
      port: this.port,
      paperSize: this.paperSize,
      purpose: this.purpose,
      copies: this.copies,
      isDefault: this.isDefault,
      enabled: this.enabled,
      bluetoothName: this.bluetoothName,
      usbVendorId: this.usbVendorId,
      usbProductId: this.usbProductId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

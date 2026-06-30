import { EventEmitter } from 'events';
import { DomainEvent } from '../../domain/DomainEvent';

export interface EventHandler {
  (event: DomainEvent): Promise<void>;
}

export class EventBus {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
  }

  publish(event: DomainEvent): void {
    this.emitter.emit(event.eventName, event);
  }

  subscribe(eventName: string, handler: EventHandler): void {
    this.emitter.on(eventName, handler);
  }

  unsubscribe(eventName: string, handler: EventHandler): void {
    this.emitter.off(eventName, handler);
  }

  removeAllListeners(eventName?: string): void {
    if (eventName) {
      this.emitter.removeAllListeners(eventName);
    } else {
      this.emitter.removeAllListeners();
    }
  }
}

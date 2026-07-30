export interface ComponentDefinition {
  type: string;
  label: string;
  hasField: boolean;
  hasChildren: boolean;
}

export class ComponentRegistry {
  private components = new Map<string, ComponentDefinition>();

  register(def: ComponentDefinition): void {
    this.components.set(def.type, def);
  }

  get(type: string): ComponentDefinition | undefined {
    return this.components.get(type);
  }

  getAll(): ComponentDefinition[] {
    return Array.from(this.components.values());
  }

  remove(type: string): void {
    this.components.delete(type);
  }

  clear(): void {
    this.components.clear();
  }
}

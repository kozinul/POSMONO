export abstract class DomainService {
  protected readonly name: string;

  constructor(name: string) {
    this.name = name;
  }
}

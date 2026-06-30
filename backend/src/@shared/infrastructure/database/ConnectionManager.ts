import mongoose, { Connection } from 'mongoose';

interface TenantConnection {
  connection: Connection;
  lastUsed: Date;
}

export class ConnectionManager {
  private connections: Map<string, TenantConnection> = new Map();
  private readonly ttlMs: number;
  private readonly systemConnection: Connection;

  constructor(mongoUri: string, ttlMs = 30 * 60 * 1000) {
    this.ttlMs = ttlMs;
    this.systemConnection = mongoose.createConnection(mongoUri);
  }

  getSystemConnection(): Connection {
    return this.systemConnection;
  }

  async getTenantConnection(tenantId: string, databaseName: string): Promise<Connection> {
    const cached = this.connections.get(tenantId);
    if (cached && Date.now() - cached.lastUsed.getTime() < this.ttlMs) {
      cached.lastUsed = new Date();
      return cached.connection;
    }

    if (cached) {
      await cached.connection.close();
      this.connections.delete(tenantId);
    }

    const uri = this.buildTenantUri(databaseName);
    const connection = mongoose.createConnection(uri);
    connection.on('error', (err) => {
      console.error(`Connection error for tenant ${tenantId}:`, err);
    });

    this.connections.set(tenantId, {
      connection,
      lastUsed: new Date(),
    });

    return connection;
  }

  async closeTenantConnection(tenantId: string): Promise<void> {
    const cached = this.connections.get(tenantId);
    if (cached) {
      await cached.connection.close();
      this.connections.delete(tenantId);
    }
  }

  async closeAll(): Promise<void> {
    for (const [tenantId] of this.connections) {
      await this.closeTenantConnection(tenantId);
    }
    await this.systemConnection.close();
  }

  private buildTenantUri(databaseName: string): string {
    const baseUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
    const base = baseUri.replace(/\/[^/]*$/, '');
    return `${base}/${databaseName}`;
  }
}

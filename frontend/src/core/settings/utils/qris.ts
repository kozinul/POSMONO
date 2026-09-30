export interface QrisGatewayConfig {
  qrisGatewayEnabled: boolean;
  qrisGatewayBaseUrl: string;
  qrisGatewayApiKey: string;
  qrisGatewayMerchantId: string;
}

export function qrisConfigComplete(qris: QrisGatewayConfig): boolean {
  return !qris.qrisGatewayEnabled
    || (!!qris.qrisGatewayBaseUrl.trim() && !!qris.qrisGatewayApiKey.trim() && !!qris.qrisGatewayMerchantId.trim());
}

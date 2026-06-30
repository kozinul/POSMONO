export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
    businessType: string;
  };
}

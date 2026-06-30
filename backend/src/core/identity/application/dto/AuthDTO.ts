export interface LoginRequestDTO {
  email: string;
  password: string;
  tenantSlug?: string;
}

export interface LoginResponseDTO {
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

export interface RegisterRequestDTO {
  tenantName: string;
  email: string;
  password: string;
  businessType: string;
}

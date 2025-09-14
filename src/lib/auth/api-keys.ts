export interface ApiKeys {
  anon: string;
  service_role: string;
}

export interface ApiKeyPayload {
  role: 'anon' | 'authenticated' | 'service_role';
  iss: string;
  iat: number;
  exp: number;
}

/**
 * Simple HMAC-SHA256 JWT implementation for API keys
 * Uses the same approach as Supabase for maximum compatibility
 */
class SimpleJWT {
  private async hmacSHA256(message: string, secret: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    return await crypto.subtle.sign('HMAC', key, messageData);
  }

  private base64UrlEncode(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private base64UrlDecode(str: string): string {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) {
      str += '=';
    }
    return atob(str);
  }

  async sign(payload: any, secret: string): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT' };
    
    const encodedHeader = this.base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
    const encodedPayload = this.base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
    
    const message = `${encodedHeader}.${encodedPayload}`;
    const signature = await this.hmacSHA256(message, secret);
    const encodedSignature = this.base64UrlEncode(signature);
    
    return `${message}.${encodedSignature}`;
  }

  decode(token: string): any | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      
      const payload = JSON.parse(this.base64UrlDecode(parts[1]));
      return payload;
    } catch {
      return null;
    }
  }

  async verify(token: string, secret: string): Promise<any | null> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      
      const [header, payload, signature] = parts;
      const message = `${header}.${payload}`;
      
      const expectedSignature = await this.hmacSHA256(message, secret);
      const expectedSignatureBase64 = this.base64UrlEncode(expectedSignature);
      
      if (signature !== expectedSignatureBase64) {
        return null;
      }
      
      const decodedPayload = JSON.parse(this.base64UrlDecode(payload));
      
      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (decodedPayload.exp && decodedPayload.exp < now) {
        return null;
      }
      
      return decodedPayload;
    } catch {
      return null;
    }
  }
}

/**
 * Generates Supabase-compatible API keys for anon and service_role
 * These are long-lived JWTs that identify the application component (not the user)
 */
export class ApiKeyGenerator {
  private simpleJWT: SimpleJWT;
  private readonly JWT_SECRET = 'supabase-lite-jwt-secret-key';

  constructor() {
    this.simpleJWT = new SimpleJWT();
  }

  /**
   * Generate anon and service_role API keys for a project
   */
  async generateApiKeys(projectId: string = 'default'): Promise<ApiKeys> {
    const now = Math.floor(Date.now() / 1000);
    const tenYears = 10 * 365 * 24 * 60 * 60; // 10 years in seconds

    // Anonymous key - for public client access (respects RLS)
    const anonPayload: ApiKeyPayload = {
      role: 'anon',
      iss: 'supabase-lite',
      iat: now,
      exp: now + tenYears
    };

    // Service role key - for admin access (bypasses RLS)
    const servicePayload: ApiKeyPayload = {
      role: 'service_role',
      iss: 'supabase-lite',
      iat: now,
      exp: now + tenYears
    };

    return {
      anon: await this.simpleJWT.sign(anonPayload, this.JWT_SECRET),
      service_role: await this.simpleJWT.sign(servicePayload, this.JWT_SECRET)
    };
  }

  /**
   * Validate and extract role from API key
   */
  async validateApiKey(apiKey: string): Promise<ApiKeyPayload | null> {
    try {
      const payload = await this.simpleJWT.verify(apiKey, this.JWT_SECRET);
      
      if (!payload) {
        return null;
      }
      
      // Validate it's a proper API key (not a user JWT)
      if (!payload.role || payload.iss !== 'supabase-lite') {
        return null;
      }

      // Validate role is valid
      if (!['anon', 'service_role'].includes(payload.role)) {
        return null;
      }

      return payload as ApiKeyPayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract role from API key without full validation
   * Used for quick role determination
   */
  extractRole(apiKey: string): 'anon' | 'service_role' | null {
    // Handle development test keys (simple strings)
    if (apiKey === 'test-service-role-key' || apiKey === 'test-service-key') {
      return 'service_role';
    }
    if (apiKey === 'test-anon-key') {
      return 'anon';
    }

    try {
      const payload = this.simpleJWT.decode(apiKey);
      if (!payload?.role || !['anon', 'service_role'].includes(payload.role)) {
        return null;
      }
      return payload.role;
    } catch {
      return null;
    }
  }

  /**
   * Check if API key is service_role (has RLS bypass privileges)
   */
  isServiceRole(apiKey: string): boolean {
    return this.extractRole(apiKey) === 'service_role';
  }

  /**
   * Get the JWT secret (for testing purposes)
   */
  getJwtSecret(): string {
    return this.JWT_SECRET;
  }
}

// Singleton instance
export const apiKeyGenerator = new ApiKeyGenerator();
/**
 * Signed URL types for Storage system
 * Provides TypeScript interfaces for signed URL operations
 */

export interface SignedUrlOptions {
  expiresIn: number; // seconds until expiration
  transform?: TransformOptions;
  download?: boolean | string; // boolean or custom filename
}

export interface TransformOptions {
  width?: number;
  height?: number;
  resize?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  quality?: number; // 1-100
  format?: 'webp' | 'jpeg' | 'png';
  rotate?: number; // degrees
}

export interface SignedUrlMetadata {
  id: string;
  bucket: string;
  path: string;
  token: string;
  expiresAt: Date;
  transform?: TransformOptions;
  download?: boolean | string;
  createdAt: Date;
  projectId: string;
}

export interface SignedUploadUrlOptions {
  expiresIn?: number; // seconds until expiration, default 1 hour
  upsert?: boolean; // allow overwrite of existing files
}

export interface SignedUploadUrlMetadata {
  id: string;
  bucket: string;
  path: string;
  token: string;
  expiresAt: Date;
  upsert: boolean;
  createdAt: Date;
  projectId: string;
}

export interface PublicUrlOptions {
  transform?: TransformOptions;
  download?: boolean | string;
}

export interface SignedUrlResponse {
  signedUrl: string;
  token?: string;
  expiresAt: string;
  expiresIn: number;
}

export interface SignedUploadUrlResponse {
  signedUrl: string;
  token: string;
  path: string;
  expiresAt: string;
  expiresIn: number;
}

export interface PublicUrlResponse {
  publicUrl: string;
}

export interface SignedUrlValidationResult {
  isValid: boolean;
  metadata?: SignedUrlMetadata | SignedUploadUrlMetadata;
  error?: string;
}

export type SignedUrlType = 'download' | 'upload';
/**
 * Barrel for the ISOMORPHIC part of the document registry: shared vocabulary, the category specs,
 * validation and the public projection. All of it is safe to import from a client component.
 *
 * The server-only modules are deliberately NOT re-exported here, so that importing this file can
 * never drag the database driver or Node's crypto into a browser bundle. Import them directly:
 *   "@/lib/documents/store"   data access        "@/lib/documents/files"   upload inspection
 *   "@/lib/documents/schema"  table creation     "@/lib/documents/codes"   verification codes
 *   "@/lib/documents/qr"      QR rendering
 */
export * from "./types";
export * from "./categories";
export * from "./validate";
export * from "./public";
export * from "./team";

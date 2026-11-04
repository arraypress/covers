// Byte helpers without Buffer.

/** Bytes as a Uint8Array view. */
export function u8(v: Uint8Array | ArrayBuffer | ArrayBufferView): Uint8Array;
/** Whether a value is bytes. */
export function isBytes(v: unknown): v is Uint8Array | ArrayBuffer;
/** Base64-encode bytes. */
export function toBase64(bytes: Uint8Array | ArrayBuffer): string;
/** Decode base64. */
export function fromBase64(s: string): Uint8Array;
/** Each byte as one character. */
export function latin1(b: Uint8Array): string;
/** Decode UTF-8. */
export function utf8(b: Uint8Array | ArrayBuffer): string;
/** Encode UTF-8. */
export function encodeUtf8(s: string): Uint8Array;
/** Join byte arrays. */
export function concat(parts: Uint8Array[]): Uint8Array;
/** A `data:` URI's bytes, or undefined when it isn't one. */
export function fromDataUri(uri: string): Uint8Array | undefined;
/** A hex digest with Web Crypto. */
export function hexDigest(algo: 'SHA-1' | 'SHA-256', data: Uint8Array | string): Promise<string>;

import crypto from "crypto";
import { env } from "../../config/env.js";

const key = crypto.scryptSync(
    env.FIELD_ENCRYPTION_KEY,
    env.ENCRYPTION_SALT,
    32,
    { N: 16384, p: 1, r: 8 }
);

function base64urlEncode(buf: Buffer): string {
    return buf.toString('base64url');
}

function base64urlDecode(str: string): Buffer {
    return Buffer.from(str, 'base64url');
}

export function encryptObject(value: any): string {
    if (typeof value !== "object" || value === null) {
        throw new Error("Value must be a non-null object to encrypt");
    }

    const jsonStr = JSON.stringify(value);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    let encrypted = cipher.update(jsonStr, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const tag = cipher.getAuthTag();

    return `v1:${base64urlEncode(encrypted)}:${base64urlEncode(iv)}:${base64urlEncode(tag)}`;
}

export function decryptObject(value: string): any {
    const parts = value.split(":");
    if (parts.length !== 4 || parts[0] !== "v1") {
        throw new Error("Invalid encrypted format or version");
    }

    const [_v1, ciphertextB64, ivB64, tagB64] = parts;
    const encrypted = base64urlDecode(ciphertextB64 as string);
    const iv = base64urlDecode(ivB64 as string);
    const tag = base64urlDecode(tagB64 as string);

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return JSON.parse(decrypted.toString("utf8"));
}

export function encryptString(value: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    let encrypted = cipher.update(value, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const tag = cipher.getAuthTag();

    return `v1:${base64urlEncode(encrypted)}:${base64urlEncode(iv)}:${base64urlEncode(tag)}`;
}

export function decryptString(value: string): string {
    const parts = value.split(":");
    if (parts.length !== 4 || parts[0] !== "v1") {
        throw new Error("Invalid encrypted format");
    }
    const [_, cipherB64, ivB64, tagB64] = parts;

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, base64urlDecode(ivB64 as string));
    decipher.setAuthTag(base64urlDecode(tagB64 as string));

    let dec = decipher.update(base64urlDecode(cipherB64 as string));
    dec = Buffer.concat([dec, decipher.final()]);
    return dec.toString("utf8");
}

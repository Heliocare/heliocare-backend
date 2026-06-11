import { AppError } from "../../utils/AppError.js";

// Performs deep-packet signature checks on a file buffer to ensure it is a valid PDF.
// Checks the Magic Bytes signature: "%PDF" (hex: 25 50 44 46)
export function validatePdfBuffer(buffer: Buffer): void {
  if (!buffer || buffer.length < 4) {
    throw new AppError("Invalid or empty file buffer.", 400);
  }

  const magic = buffer.subarray(0, 4).toString("hex").toLowerCase();

  if (magic !== "25504446") {
    throw new AppError("Security validation failed: Magic bytes do not match PDF format.", 400);
  }
}

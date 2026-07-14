import { createHash } from "crypto";

/** Deterministic sha256 hex digest. Used to identify file/JD content. */
export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

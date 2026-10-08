export class RequestBodyError extends Error {
  constructor(public readonly status: 400 | 413) {
    super(
      status === 413
        ? "Request is too large."
        : "Request body could not be read.",
    );
    this.name = "RequestBodyError";
  }
}

// Enforce bytes while streaming, including requests without Content-Length.
// Preserve the exact bytes for payment-provider signature verification.
export async function readLimitedBody(
  request: Request,
  maxBytes: number,
): Promise<Buffer> {
  const length = request.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > maxBytes) {
    await request.body?.cancel().catch(() => {});
    throw new RequestBodyError(413);
  }
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new RequestBodyError(413);
      }
      chunks.push(Buffer.from(chunk.value));
    }
    return Buffer.concat(chunks, total);
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError(400);
  } finally {
    reader.releaseLock();
  }
}

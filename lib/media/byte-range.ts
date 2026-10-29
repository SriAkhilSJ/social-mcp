export interface ParsedByteRange {
  valid: boolean;
  start: number;
  end: number;
  chunkSize: number;
}

/**
 * RFC 9110 compliant byte-range parser.
 * Supports:
 * - standard ranges: "bytes=0-499"
 * - open-ended ranges: "bytes=500-"
 * - suffix ranges: "bytes=-500" (last 500 bytes)
 * Returns status 200 (full file), 206 (partial range), or 416 (range not satisfiable).
 */
export function parseByteRange(
  rangeHeader: string,
  totalSize: number
): { status: 206; range: ParsedByteRange } | { status: 416 } | { status: 200 } {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) {
    return { status: 200 };
  }

  let rangeSpec = rangeHeader.slice("bytes=".length).trim();
  // If multiple comma-separated ranges, inspect the first range
  if (rangeSpec.includes(",")) {
    rangeSpec = rangeSpec.split(",")[0].trim();
  }

  // Suffix byte range: e.g. bytes=-500 (last 500 bytes of the file)
  if (rangeSpec.startsWith("-")) {
    const suffixLength = parseInt(rangeSpec.slice(1), 10);
    if (isNaN(suffixLength) || suffixLength <= 0) {
      return { status: 416 };
    }
    const actualLength = Math.min(suffixLength, totalSize);
    const start = totalSize - actualLength;
    const end = totalSize - 1;
    return {
      status: 206,
      range: {
        valid: true,
        start,
        end,
        chunkSize: end - start + 1,
      },
    };
  }

  // Standard ranges: "start-end" or "start-"
  const parts = rangeSpec.split("-");
  if (parts.length !== 2) {
    return { status: 416 };
  }

  const startStr = parts[0].trim();
  const endStr = parts[1].trim();

  const start = parseInt(startStr, 10);
  if (isNaN(start) || start < 0 || start >= totalSize) {
    return { status: 416 };
  }

  let end: number;
  if (endStr === "") {
    // Open-ended: bytes=500-
    end = totalSize - 1;
  } else {
    end = parseInt(endStr, 10);
    if (isNaN(end) || end < start) {
      return { status: 416 };
    }
    // Cap end if client requested beyond EOF
    if (end >= totalSize) {
      end = totalSize - 1;
    }
  }

  return {
    status: 206,
    range: {
      valid: true,
      start,
      end,
      chunkSize: end - start + 1,
    },
  };
}

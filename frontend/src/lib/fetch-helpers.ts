// Simple fetch helper - no Host header manipulation needed
// Direct service calls are used instead

export const createFetchHeaders = (
  additionalHeaders: Record<string, string> = {}
): HeadersInit => {
  return { ...additionalHeaders };
};

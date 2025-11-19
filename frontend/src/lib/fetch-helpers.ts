// Utility for creating request headers that work with both ngrok and local Kourier
export const createFetchHeaders = (
  customHost: string | null,
  additionalHeaders: Record<string, string> = {}
): HeadersInit => {
  const headers: Record<string, string> = {
    ...additionalHeaders,
  };
  
  // Only add custom Host header when NOT using ngrok (ngrok rejects custom Host headers)
  if (customHost) {
    headers['Host'] = customHost;
  }
  
  return headers;
};

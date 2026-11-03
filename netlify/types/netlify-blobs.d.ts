declare module '@netlify/blobs' {
  export function getStore(name: string): {
    getWithMetadata(key: string, options?: { consistency?: 'strong' | 'eventual'; type?: 'json' }): Promise<{ data: any; etag: string } | null>;
    setJSON(key: string, value: unknown, options?: { onlyIfMatch?: string; onlyIfNew?: boolean }): Promise<{ modified: boolean; etag?: string }>;
  };
}

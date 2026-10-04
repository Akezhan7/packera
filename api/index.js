// Both deployment entrypoints use the same authentication and write routes.
if (process.env.KV_REST_API_URL || process.env.KV_REST_API_TOKEN) {
  throw new Error('Vercel KV backend is unsupported. Configure PostgreSQL DATABASE_URL; KV writes are disabled.');
}
const { default: app } = await import('../server.js');
export default app;

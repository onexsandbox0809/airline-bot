import { createApp } from '../src/app';

// Vercel's Node runtime can invoke an Express app directly as a request handler.
// vercel.json rewrites all /api/* and /health traffic here.
const app = createApp();

export default app;

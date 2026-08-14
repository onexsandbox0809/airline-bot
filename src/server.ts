import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

app.listen(env.port, () => {
  console.log(`Airline booking bot API listening on port ${env.port}`);
  console.log(`Swagger docs: http://localhost:${env.port}/api-docs`);
  console.log(`Health check: http://localhost:${env.port}/health`);
});

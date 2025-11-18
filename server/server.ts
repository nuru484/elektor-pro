// server.ts
import app from './app.js';
import ENV from './src/config/env.js';

const port = ENV.PORT || 3000;

app.listen(port, () => {
  const message =
    ENV.NODE_ENV === 'production' ? `App is running in production mode on port ${port}` : `App is listening on http://localhost:${port}`;
  console.log(message);
});

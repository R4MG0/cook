const { createApiServer } = require('./api');
const { createDatabase } = require('./database');

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';
const database = createDatabase();
const server = createApiServer(database);

server.listen(port, host, () => {
  console.log(`Recipe API listening on http://127.0.0.1:${port}`);
});

function shutdown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

import http from "http";

const port = Number(process.env.UPSTREAM_PORT || 3010);

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader("content-type", "text/plain");
  res.end(`UPSTREAM_OK ${req.method} ${req.url}\n`);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[ci-upstream] listening on http://127.0.0.1:${port}`);
});

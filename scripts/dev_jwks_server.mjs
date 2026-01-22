#!/usr/bin/env node
import http from "node:http";
import { generateKeyPair, exportJWK, SignJWT } from "jose";

const PORT = Number(process.env.PORT ?? 8088);
const HOST = process.env.HOST ?? "127.0.0.1";
const NONCE = process.env.NONCE ?? "bb-test";
const KID = process.env.KID ?? "dev-local-1";

const { publicKey, privateKey } = await generateKeyPair("EdDSA");

const jwk = await exportJWK(publicKey);
jwk.kid = KID;
jwk.use = "sig";
jwk.alg = "EdDSA";

const jwks = { keys: [jwk] };

const jws = await new SignJWT({ nonce: NONCE, purpose: "x402-dev-harness" })
  .setProtectedHeader({ alg: "EdDSA", kid: KID })
  .setIssuedAt()
  .setExpirationTime("5m")
  .sign(privateKey);

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/.well-known/jwks.json") {
    const body = JSON.stringify(jwks);
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(body);
    return;
  }
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("not found");
});

server.listen(PORT, HOST, () => {
  console.log(`JWKS_URL=http://${HOST}:${PORT}/.well-known/jwks.json`);
  console.log(`RECEIPT_JWS=${jws}`);
  console.log(`NONCE=${NONCE}`);
  console.log(`(keep this process running while you run the harness)`);
});

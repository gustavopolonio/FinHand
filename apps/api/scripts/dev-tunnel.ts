import { spawn, type ChildProcess } from "node:child_process";
import {
  createServer,
  request as createProxyRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { connect, type Socket } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const currentDirectory = dirname(fileURLToPath(import.meta.url));

config({
  path: resolve(currentDirectory, "../../../.env"),
  quiet: true,
});

const proxyHost = "127.0.0.1";
const proxyPort = 3100;
const webOrigin = new URL("http://127.0.0.1:3000");
const apiOrigin = new URL("http://127.0.0.1:3001");

function requiredPublicUrl(): URL {
  const value = process.env.NGROK_URL?.trim();

  if (!value) {
    throw new Error("NGROK_URL is required to start the development tunnel.");
  }

  const publicUrl = new URL(value);

  if (publicUrl.protocol !== "https:" || publicUrl.pathname !== "/") {
    throw new Error("NGROK_URL must be an HTTPS origin without a path.");
  }

  return publicUrl;
}

function targetFor(requestUrl: string | undefined): URL {
  return requestUrl?.startsWith("/api/") ? apiOrigin : webOrigin;
}

function forwardedHeaders(
  request: IncomingMessage,
): IncomingHttpHeaders {
  const remoteAddress = request.socket.remoteAddress;
  const existingForwardedFor = request.headers["x-forwarded-for"];
  const forwardedFor = [
    ...(Array.isArray(existingForwardedFor)
      ? existingForwardedFor
      : existingForwardedFor
        ? [existingForwardedFor]
        : []),
    ...(remoteAddress ? [remoteAddress] : []),
  ].join(", ");

  return {
    ...request.headers,
    ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
    "x-forwarded-host": request.headers.host,
    "x-forwarded-proto": "https",
  };
}

function proxyHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const target = targetFor(request.url);
  const proxyRequest = createProxyRequest(
    {
      headers: forwardedHeaders(request),
      hostname: target.hostname,
      method: request.method,
      path: request.url,
      port: target.port,
    },
    (proxyResponse) => {
      response.writeHead(
        proxyResponse.statusCode ?? 502,
        proxyResponse.headers,
      );
      proxyResponse.pipe(response);
    },
  );

  proxyRequest.on("error", (error) => {
    console.error("Development tunnel upstream request failed", {
      error: error.message,
      target: target.origin,
    });

    if (!response.headersSent) {
      response.writeHead(502, { "content-type": "application/json" });
    }

    response.end(JSON.stringify({ error: "Local upstream is unavailable." }));
  });
  request.pipe(proxyRequest);
}

function serializeUpgradeRequest(
  request: IncomingMessage,
  target: URL,
): string {
  const headers = forwardedHeaders(request);
  const serializedHeaders = Object.entries(headers).flatMap(([name, value]) =>
    value === undefined
      ? []
      : Array.isArray(value)
        ? value.map((item) => `${name}: ${item}`)
        : [`${name}: ${value}`],
  );

  return [
    `${request.method ?? "GET"} ${request.url ?? "/"} HTTP/${request.httpVersion}`,
    ...serializedHeaders,
    "",
    "",
  ].join("\r\n");
}

function proxyWebSocket(
  request: IncomingMessage,
  clientSocket: Socket,
  head: Buffer,
) {
  const target = targetFor(request.url);
  const upstreamSocket = connect(
    Number(target.port),
    target.hostname,
    () => {
      upstreamSocket.write(serializeUpgradeRequest(request, target));

      if (head.length > 0) {
        upstreamSocket.write(head);
      }

      clientSocket.pipe(upstreamSocket).pipe(clientSocket);
    },
  );

  upstreamSocket.on("error", (error) => {
    console.error("Development tunnel WebSocket proxy failed", {
      error: error.message,
      target: target.origin,
    });
    clientSocket.destroy();
  });
}

async function closeServer(server: ReturnType<typeof createServer>) {
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) {
        rejectClose(error);
        return;
      }

      resolveClose();
    });
    server.closeAllConnections();
  });
}

const publicUrl = requiredPublicUrl();
const sockets = new Set<Socket>();
const proxyServer = createServer(proxyHttpRequest);

proxyServer.on("connection", (socket) => {
  sockets.add(socket);
  socket.once("close", () => sockets.delete(socket));
});
proxyServer.on("upgrade", proxyWebSocket);

await new Promise<void>((resolveListen, rejectListen) => {
  proxyServer.once("error", rejectListen);
  proxyServer.listen(proxyPort, proxyHost, () => {
    proxyServer.off("error", rejectListen);
    resolveListen();
  });
});

console.info(
  `Development tunnel proxy listening on http://${proxyHost}:${proxyPort}`,
);
console.info(`Forwarding ${publicUrl.origin}/api/* to ${apiOrigin.origin}`);
console.info(`Forwarding all other traffic to ${webOrigin.origin}`);

let ngrok: ChildProcess | undefined;
let isShuttingDown = false;

async function shutdown(signal?: NodeJS.Signals) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  if (signal) {
    console.info("Shutting down development tunnel", { signal });
  }

  ngrok?.kill("SIGTERM");

  for (const socket of sockets) {
    socket.destroy();
  }

  await closeServer(proxyServer);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

ngrok = spawn(
  "ngrok",
  ["http", String(proxyPort), "--url", publicUrl.origin],
  { stdio: "inherit" },
);

ngrok.once("error", async (error) => {
  console.error("Could not start ngrok", error);
  process.exitCode = 1;
  await shutdown();
});
ngrok.once("exit", async (code, signal) => {
  if (!isShuttingDown) {
    if (signal) {
      console.error("ngrok stopped unexpectedly", { signal });
    } else if (code !== 0) {
      console.error("ngrok exited with an error", { code });
    }

    process.exitCode = code ?? 1;
    await shutdown();
  }
});

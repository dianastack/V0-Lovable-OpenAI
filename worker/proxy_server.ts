/**
 * proxy.js – zero-dependency worker-based HTTP/WS forwarder that
 *            remembers the last ?url=… origin and injects a
 *            console-log script into index.html
 *
 *  • run:  node proxy.js
 *  • listen: http://127.0.0.1:31111
 *
 *  Routing rules
 *    a) If query has `url=ABSOLUTE_URL`
 *         – forward to ABSOLUTE_URL
 *         – remember ABSOLUTE_URL.origin
 *    b) Otherwise
 *         – if an origin is remembered → forward to   origin + req.path
 *         – else 400
 *
 *  WebSocket (Upgrade) requests are tunneled, so
 *    ws://127.0.0.1:31111/vite-dev-ws   works.
 *
 *  When an upstream reply is uncompressed text/html whose pathname
 *  ends with  "index.html",   the html is patched with
 *     <script>console.log("injected!!")</script>
 */

const { Worker, isMainThread, parentPort } = require("worker_threads");
const http = require("http");
const https = require("https");
const net = require("net");
const tls = require("tls");
const { URL } = require("url");

const LISTEN_HOST = "127.0.0.1";
const LISTEN_PORT = 31111;
const INJECT_TAG = '<script>console.log("injected!!")</script>';

if (isMainThread) {
  const w = new Worker(__filename);
  w.on("message", (m) => console.log("[proxy-worker]", m));
  w.on("error", (e) => console.error("[proxy-worker] error:", e));
  w.on("exit", (c) => console.log("[proxy-worker] exited", c));
  console.log("proxy worker launching …");
  return;
}

/* ---------- worker code ---------- */

let rememberedOrigin = null; // e.g. "http://localhost:5173"

function needsInjection(pathname, headers) {
  const html = (headers["content-type"] || "").includes("text/html");
  const enc = (headers["content-encoding"] || "").toLowerCase();
  return pathname.endsWith("/");
  return (
    html && (!enc || enc === "identity") && pathname.endsWith("index.html")
  );
}

function injectHTML(buf) {
  let txt = buf.toString("utf8");
  if (!txt.includes(INJECT_TAG)) {
    txt = txt.includes("</body>")
      ? txt.replace("</body>", INJECT_TAG + "</body>")
      : txt + INJECT_TAG;
  }
  console.log("INJECT txt", txt);
  return Buffer.from(txt, "utf8");
}

/* ---- common helper: build upstream URL from incoming request ---- */
function buildTargetURL(clientReq) {
  const parsedLocal = new URL(clientReq.url, `http://${LISTEN_HOST}`);
  const urlParam = parsedLocal.searchParams.get("url");

  if (urlParam) {
    const abs = new URL(urlParam);
    console.log("abs", abs);
    if (abs.protocol !== "http:" && abs.protocol !== "https:")
      throw new Error("only http/https targets allowed");
    rememberedOrigin = abs.origin; // remember for later
    return abs;
  }

  if (!rememberedOrigin)
    throw new Error("no remembered origin (call once with ?url=…)");

  // relative to last origin:
  return new URL(clientReq.url, rememberedOrigin);
}

/* ----------------------------------------------------------------- */
/*  1. normal HTTP request / response                                */
/* ----------------------------------------------------------------- */
const server = http.createServer((clientReq, clientRes) => {
  let target;
  try {
    target = buildTargetURL(clientReq);
  } catch (err) {
    clientRes.writeHead(400, { "content-type": "text/plain" });
    return void clientRes.end("Bad request: " + err.message);
  }

  const isTLS = target.protocol === "https:";
  const lib = isTLS ? https : http;

  /* Build headers: copy, but fix Host/Origin/Referer if cross origin */
  const headers = { ...clientReq.headers, host: target.host };
  if (headers.origin) headers.origin = target.origin;
  if (headers.referer) {
    try {
      // may throw if referer malformed
      const ref = new URL(headers.referer);
      headers.referer = target.origin + ref.pathname + ref.search;
    } catch (_) {
      delete headers.referer;
    }
  }

  const upOpts = {
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || (isTLS ? 443 : 80),
    path: target.pathname + target.search,
    method: clientReq.method,
    headers,
  };

  const upReq = lib.request(upOpts, (upRes) => {
    const inject = needsInjection(target.pathname, upRes.headers);

    if (!inject) {
      clientRes.writeHead(upRes.statusCode, upRes.headers);
      upRes.pipe(clientRes);
      return;
    }

    const chunks = [];
    upRes.on("data", (c) => chunks.push(c));
    upRes.on("end", () => {
      try {
        const merged = Buffer.concat(chunks);
        console.log("merged", merged);
        const patched = injectHTML(merged);
        const hdrs = {
          ...upRes.headers,
          "content-length": Buffer.byteLength(patched),
        };
        clientRes.writeHead(upRes.statusCode, hdrs);
        console.log("patched", patched.toString("utf8"));
        clientRes.end(patched);
      } catch (e) {
        clientRes.writeHead(500, { "content-type": "text/plain" });
        clientRes.end("Injection failed: " + e.message);
      }
    });
  });

  clientReq.pipe(upReq);
  upReq.on("error", (e) => {
    clientRes.writeHead(502, { "content-type": "text/plain" });
    clientRes.end("Upstream error: " + e.message);
  });
});

/* ----------------------------------------------------------------- */
/*  2.  WebSocket / generic Upgrade tunnelling                       */
/* ----------------------------------------------------------------- */
server.on("upgrade", (req, socket, head) => {
  let target;
  try {
    target = buildTargetURL(req);
  } catch (err) {
    socket.write("HTTP/1.1 400 Bad Request\r\n\r\n" + err.message);
    return socket.destroy();
  }

  const isTLS = target.protocol === "https:";

  /* prepare headers for the upstream handshake */
  const headers = { ...req.headers, host: target.host };
  if (headers.origin) headers.origin = target.origin;

  const upReq = (isTLS ? https : http).request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || (isTLS ? 443 : 80),
    path: target.pathname + target.search,
    method: "GET",
    headers,
  });

  upReq.on("upgrade", (upRes, upSocket, upHead) => {
    // 101 just received from upstream ─ tunnel both sockets
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        Object.entries(upRes.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\r\n") +
        "\r\n\r\n",
    );
    if (upHead && upHead.length) socket.write(upHead);

    // bi-directional pipe (no back-pressure support needed here)
    upSocket.pipe(socket).pipe(upSocket);
  });

  upReq.on("error", () => socket.destroy());
  // send the initial head (if any) after socket established
  upReq.end();
});

/* ----------------------------------------------------------------- */
server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  parentPort?.postMessage(
    `proxy listening on http://${LISTEN_HOST}:${LISTEN_PORT}`,
  );
});

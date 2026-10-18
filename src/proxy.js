import { execSync } from "node:child_process";
import { Agent, ProxyAgent } from "undici";

function fromEnv() {
  return (
    process.env.OPENAI_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy ||
    ""
  ).trim();
}

function fromMacSystemProxy() {
  if (process.platform !== "darwin") return "";
  try {
    const raw = execSync(
      'python3 -c "import urllib.request,json; print(json.dumps(urllib.request.getproxies()))"',
      { encoding: "utf8", timeout: 3000 },
    ).trim();
    const proxies = JSON.parse(raw);
    return String(proxies.https || proxies.http || proxies.socks || "").trim();
  } catch {
    return "";
  }
}

export function resolveProxyUrl() {
  return fromEnv() || fromMacSystemProxy() || "";
}

export function createDispatcher(proxyUrl = resolveProxyUrl()) {
  const timeouts = {
    connectTimeout: 60_000,
    headersTimeout: 30 * 60 * 1000,
    bodyTimeout: 30 * 60 * 1000,
  };

  if (proxyUrl) {
    return {
      proxyUrl,
      dispatcher: new ProxyAgent({
        uri: proxyUrl,
        ...timeouts,
        requestTls: {
          timeout: 60_000,
        },
      }),
    };
  }

  return {
    proxyUrl: "",
    dispatcher: new Agent({
      ...timeouts,
      connect: {
        family: 4,
        timeout: 60_000,
      },
      autoSelectFamily: true,
      autoSelectFamilyAttemptTimeout: 300,
    }),
  };
}

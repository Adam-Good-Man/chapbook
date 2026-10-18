import OpenAI from "openai";
import { fetch as undiciFetch } from "undici";
import { getApiKey, getBaseURL, getModel, getReasoningEffort, getTimeoutMs } from "./config.js";
import { createDispatcher } from "./proxy.js";
import { extractJson } from "./text.js";

const { proxyUrl, dispatcher } = createDispatcher();

function createClient() {
  return new OpenAI({
    apiKey: getApiKey(),
    baseURL: getBaseURL(),
    timeout: getTimeoutMs(),
    maxRetries: 0,
    fetch: (url, init) => undiciFetch(url, { ...init, dispatcher }),
  });
}

export function getOpenAIClient() {
  return createClient();
}

export function getActiveProxy() {
  return proxyUrl || null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTimeout(error) {
  const message = `${error?.message || error} ${error?.cause || ""}`;
  return (
    error?.status === 408 ||
    error?.code === "ETIMEDOUT" ||
    error?.code === "UND_ERR_CONNECT_TIMEOUT" ||
    error?.name === "APIConnectionTimeoutError" ||
    error?.name === "APITimeoutError" ||
    /timeout|timed out|ETIMEDOUT|ECONNRESET|socket hang up|abortexerror|headers timeout|connect timeout/i.test(
      message,
    )
  );
}

function isRetryable(error) {
  if (error?.retryable) return true;
  if (isTimeout(error)) return true;
  if (error?.status === 429 || error?.status >= 500) return true;
  const message = error?.message || String(error);
  return /rate limit|overloaded|temporar|try again|空内容|502|503|504|524/i.test(message);
}

function isUnsupportedParam(error) {
  const message = error?.message || String(error);
  return /reasoning_effort|unsupported|unknown parameter|unrecognized|stream.*json|json.*stream/i.test(
    message,
  );
}

function effortLadder(kind) {
  const start = getReasoningEffort(kind);
  const down = ["max", "xhigh", "high", "medium", "low", "none"];
  const from = down.includes(start) ? down.slice(down.indexOf(start)) : ["low", "none"];
  return [...new Set([start, ...from])].slice(0, 3);
}

function startHeartbeat(onProgress) {
  if (!onProgress) return () => {};
  const started = Date.now();
  const timer = setInterval(() => {
    const seconds = Math.round((Date.now() - started) / 1000);
    onProgress(`模型仍在生成，已等待 ${seconds} 秒…`);
  }, 8000);
  return () => clearInterval(timer);
}

async function completeOnce(client, payload, onProgress) {
  // 必须流式：经本地代理时，非流式会在模型思考阶段被空闲超时掐断。
  const request = { ...payload, stream: true };
  delete request.response_format;

  const stream = await client.chat.completions.create(request);
  let text = "";
  let sawChunk = false;
  for await (const chunk of stream) {
    const piece = chunk.choices?.[0]?.delta?.content || "";
    if (piece) {
      if (!sawChunk) {
        sawChunk = true;
        onProgress?.("已开始收到模型输出…");
      }
      text += piece;
    }
  }
  return text;
}

export async function chat({
  messages,
  kind = "chapter",
  maxCompletionTokens = 16_000,
  json = false,
  onProgress,
}) {
  const client = createClient();
  const model = getModel();
  const base = {
    model,
    messages: json
      ? [
          ...messages,
          {
            role: "user",
            content: "请只输出一个合法 JSON 对象，不要 Markdown 代码块，不要解释。",
          },
        ]
      : messages,
    max_completion_tokens: maxCompletionTokens,
  };

  const efforts = effortLadder(kind);
  let lastError;

  for (let i = 0; i < efforts.length; i += 1) {
    const effort = efforts[i];
    const payload =
      effort && effort !== "none" ? { ...base, reasoning_effort: effort } : { ...base };
    const stopHeartbeat = startHeartbeat(onProgress);
    try {
      if (i === 0) {
        onProgress?.(proxyUrl ? `网络走代理：${proxyUrl}` : "网络直连 OpenAI（未检测到本机代理）");
      }
      if (i > 0) {
        onProgress?.(`上次请求超时或失败，正在用更轻的推理重试（${effort || "默认"}）…`);
        await sleep(800 * i);
      }
      const text = await completeOnce(client, payload, onProgress);
      stopHeartbeat();
      if (!text.trim()) {
        const empty = new Error("模型返回空内容。");
        empty.retryable = true;
        throw empty;
      }
      return text;
    } catch (error) {
      stopHeartbeat();
      lastError = error;
      if (isUnsupportedParam(error) && effort) {
        continue;
      }
      if (isRetryable(error) && i < efforts.length - 1) {
        continue;
      }
      const hint = isTimeout(error)
        ? proxyUrl
          ? " 代理已启用但仍超时，请确认 Clash/V2Ray 在线，或检查规则是否放行 api.openai.com。"
          : " 本机直连 OpenAI 不通。请开启系统代理，或在 .env 填写 HTTPS_PROXY=http://127.0.0.1:7897"
        : "";
      error.message = `${error.message || error}${hint}`;
      throw error;
    }
  }
  throw lastError;
}

export async function chatJson(options) {
  let lastError;
  let messages = options.messages;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const raw = await chat({ ...options, messages, json: true });
      return extractJson(raw);
    } catch (error) {
      lastError = error;
      const broken = /JSON|parse|可解析|Expected|Unexpected/i.test(error?.message || "");
      if (!broken || attempt === 2) throw error;
      options.onProgress?.("JSON 不完整，正在要求模型重新输出更精简的完整结果…");
      messages = [
        ...options.messages,
        {
          role: "user",
          content:
            "上一次输出的 JSON 不完整或非法。请重新输出一个更精简、字段齐全、可被 JSON.parse 的完整对象，不要截断。",
        },
      ];
    }
  }
  throw lastError;
}

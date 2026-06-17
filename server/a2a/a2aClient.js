/**
 * A2A Client — used by the CEO to discover and call specialist agents
 *
 * Implements the A2A protocol:
 *   1. Fetch agent card from /.well-known/agent-card.json
 *   2. POST tasks/send with JSON-RPC 2.0
 *   3. Poll tasks/get until completed or failed
 */

import { v4 as uuidv4 } from "uuid";

const POLL_INTERVAL_MS = 400;
const POLL_TIMEOUT_MS = 60_000;

/** Fetch an agent's discovery card */
export async function fetchAgentCard(baseUrl) {
  const res = await fetch(`${baseUrl}/.well-known/agent-card.json`);
  if (!res.ok) throw new Error(`Failed to fetch agent card from ${baseUrl}: ${res.status}`);
  return res.json();
}

/** Send a task to an agent and return immediately with the task object */
export async function sendTask(baseUrl, taskText, taskId = uuidv4()) {
  const body = {
    jsonrpc: "2.0",
    method: "tasks/send",
    params: {
      id: taskId,
      message: {
        role: "user",
        parts: [{ type: "text", text: taskText }]
      }
    },
    id: uuidv4()
  };

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (data.error) throw new Error(`A2A error: ${data.error.message}`);
  return data.result;
}

/** Get current task status */
export async function getTask(baseUrl, taskId) {
  const body = {
    jsonrpc: "2.0",
    method: "tasks/get",
    params: { id: taskId },
    id: uuidv4()
  };

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (data.error) throw new Error(`A2A error: ${data.error.message}`);
  return data.result;
}

/** Send a task and wait for it to complete, polling until done */
export async function sendTaskAndWait(baseUrl, taskText, onProgress = null) {
  const taskId = uuidv4();
  await sendTask(baseUrl, taskText, taskId);

  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const task = await getTask(baseUrl, taskId);

    if (onProgress) onProgress(task);

    const state = task?.status?.state;
    if (state === "completed") {
      return extractArtifactText(task);
    }
    if (state === "failed") {
      throw new Error(`Agent task failed: ${task?.status?.message || "unknown error"}`);
    }
  }

  throw new Error(`Agent task timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

/** Stream a task using SSE (tasks/sendSubscribe) and return the final text */
export async function sendTaskStreaming(baseUrl, taskText, onChunk = null) {
  const taskId = uuidv4();
  const body = {
    jsonrpc: "2.0",
    method: "tasks/sendSubscribe",
    params: {
      id: taskId,
      message: {
        role: "user",
        parts: [{ type: "text", text: taskText }]
      }
    },
    id: uuidv4()
  };

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`A2A stream error: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (onChunk) onChunk(event);
        if (event?.result?.status?.state === "completed") {
          finalResult = extractArtifactText(event.result);
        }
      } catch {}
    }
  }

  return finalResult;
}

function extractArtifactText(task) {
  const artifacts = task?.artifacts || [];
  if (!artifacts.length) return null;
  const parts = artifacts[0]?.parts || [];
  return parts.filter(p => p.type === "text").map(p => p.text).join("\n");
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** Discover all agents and return their cards */
export async function discoverAgents(agentUrls) {
  const results = await Promise.allSettled(
    agentUrls.map(async url => {
      const card = await fetchAgentCard(url);
      return { url, card };
    })
  );
  return results
    .filter(r => r.status === "fulfilled")
    .map(r => r.value);
}

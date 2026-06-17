import { useEffect, useRef, useCallback } from "react";

let _counter = 0;
function uid() {
  return `${Date.now()}-${++_counter}`;
}

export function useWebSocket(
  url: string,
  handlers: {
    onInit?: (data: unknown) => void;
    onAgentStatus?: (agentId: string, status: string, currentTask?: string) => void;
    onChatMessage?: (msg: unknown) => void;
    onTaskCreated?: (task: unknown) => void;
    onTaskUpdated?: (id: string, status: string) => void;
    onCeoDirective?: (text: string) => void;
    onSystemStats?: (stats: unknown) => void;
    onContextWindow?: (data: unknown) => void;
    onConnected?: (connected: boolean) => void;
  }
) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout>;
    let isMounted = true;

    function connect() {
      if (!isMounted) return;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        handlersRef.current.onConnected?.(true);
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data as string) as Record<string, unknown>;
          const h = handlersRef.current;
          switch (data.type) {
            case "init":
              h.onInit?.(data);
              break;
            case "agent_status":
              h.onAgentStatus?.(data.agentId as string, data.status as string, data.currentTask as string | undefined);
              break;
            case "chat_message":
              h.onChatMessage?.({ ...data, id: uid() });
              break;
            case "agent_message":
              h.onChatMessage?.({ ...data, type: "chat_message", role: "assistant", id: uid() });
              break;
            case "task_created":
              h.onTaskCreated?.(data.task);
              break;
            case "task_updated":
              h.onTaskUpdated?.(data.id as string, data.status as string);
              break;
            case "ceo_directive":
              h.onCeoDirective?.(data.text as string);
              break;
            case "system_stats":
              h.onSystemStats?.(data);
              break;
            case "context_window":
              h.onContextWindow?.(data.data);
              break;
          }
        } catch {}
      };

      ws.onclose = () => {
        if (!isMounted) return;
        handlersRef.current.onConnected?.(false);
        retryTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();
    return () => {
      isMounted = false;
      clearTimeout(retryTimeout);
      wsRef.current?.close();
    };
  }, [url]);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { send };
}

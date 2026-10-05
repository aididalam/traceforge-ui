"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPublicClient, PublicApiError } from "../lib/public-client";
import type { PublicEntity, PublicEvent, PublicHistory } from "../lib/public-contract";

const client = createPublicClient(process.env.NEXT_PUBLIC_API_BASE_URL ?? "");
type Ready = { kind: "ready"; entity: PublicEntity; events: PublicEvent[]; page: PublicHistory["page"] };
type State = { kind: "loading" } | { kind: "failed"; error: PublicApiError } | Ready;
const failure = (error: unknown) => error instanceof PublicApiError ? error : new PublicApiError("unavailable");

export function useTrace(tenantId: string, entityId: string) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [version, setVersion] = useState(0);
  const [paging, setPaging] = useState(false);
  const [pageError, setPageError] = useState<PublicApiError | null>(null);
  const active = useRef<AbortController | null>(null);
  const pagingLock = useRef(false);
  const rateLimit = useRef<PublicApiError | null>(null);

  const refresh = useCallback(() => {
    active.current?.abort();
    if (rateLimit.current && rateLimit.current.retryAt > Date.now()) {
      setState({ kind: "failed", error: rateLimit.current });
      setPageError(null);
      return;
    }
    rateLimit.current = null;
    setState({ kind: "loading" });
    setPageError(null);
    setVersion(value => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    active.current = controller;
    pagingLock.current = false;
    setPaging(false);
    setPageError(null);
    setState({ kind: "loading" });
    Promise.all([
      client.entity(tenantId, entityId, controller.signal),
      client.history(tenantId, entityId, "0", 50, controller.signal),
    ]).then(([entity, history]) => {
      if (controller.signal.aborted) return;
      // History may have been read after a state update; use its current projection.
      setState({ kind: "ready", entity: history.entity ?? entity, events: history.events, page: history.page });
      document.documentElement.classList.remove("trace-suspended");
    }).catch(error => {
      if (controller.signal.aborted) return;
      controller.abort();
      const problem = failure(error);
      if (problem.kind === "rateLimited") rateLimit.current = problem;
      setState({ kind: "failed", error: problem });
      document.documentElement.classList.remove("trace-suspended");
    });
    return () => controller.abort();
  }, [tenantId, entityId, version]);

  useEffect(() => {
    if (state.kind === "failed") document.documentElement.classList.remove("trace-suspended");
  }, [state.kind]);

  useEffect(() => {
    const suspend = () => {
      // Hide synchronously before a back-forward-cache snapshot is taken.
      document.documentElement.classList.add("trace-suspended");
      active.current?.abort();
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") suspend();
      else if (state.kind === "ready" || state.kind === "loading") refresh();
    };
    const show = (event: PageTransitionEvent) => {
      if (event.persisted && (state.kind === "ready" || state.kind === "loading")) refresh();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", suspend);
    window.addEventListener("pageshow", show);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", suspend);
      window.removeEventListener("pageshow", show);
    };
  }, [state.kind, refresh]);

  useEffect(() => () => document.documentElement.classList.remove("trace-suspended"), []);

  const loadMore = async () => {
    if (state.kind !== "ready" || !state.page.hasMore || !state.page.nextAfterEventId ||
        pagingLock.current || (pageError?.retryAt ?? 0) > Date.now()) return;
    const controller = active.current;
    if (!controller || controller.signal.aborted) return;
    pagingLock.current = true;
    setPaging(true);
    setPageError(null);
    try {
      const history = await client.history(tenantId, entityId, state.page.nextAfterEventId, 50, controller.signal);
      if (controller.signal.aborted) return;
      setState(previous => {
        if (previous.kind !== "ready") return previous;
        const ids = new Set(previous.events.map(event => event.eventId));
        return { kind: "ready", entity: history.entity,
          events: [...previous.events, ...history.events.filter(event => !ids.has(event.eventId))], page: history.page };
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      const problem = failure(error);
      if (problem.kind === "rateLimited") rateLimit.current = problem;
      if (problem.kind === "missing") {
        controller.abort();
        setState({ kind: "failed", error: problem });
      } else setPageError(problem);
    } finally {
      if (active.current === controller) {
        pagingLock.current = false;
        setPaging(false);
      }
    }
  };
  return { state, refresh, loadMore, paging, pageError };
}

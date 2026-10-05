"use client";

import Link from "next/link";
import { useTrace } from "./use-trace";
import { displayDate, HashValue, Heading, Problem, shortId, useRetryWait } from "./display";
import { PublicApiError } from "../lib/public-client";
import { normalizeId } from "../lib/urls";
import type { PublicEvent } from "../lib/public-contract";

function TimelineEvent({ event }: { event: PublicEvent }) {
  const title = event.eventTypeLabel || event.eventName.replace(/([a-z])([A-Z])/g, "$1 $2");
  return <li className="timeline-event">
    <span className="timeline-dot" aria-hidden="true" />
    <article>
      <div className="event-top"><span className="eyebrow">EVENT {event.eventId}</span><span className="block-label">Block {event.blockNumber}</span></div>
      <h3>{title}</h3>
      <div className="event-tags">
        {event.stateAfterLabel && <span className="tag">{event.stateAfterLabel}</span>}
        {event.linkTypeLabel && <span className="tag neutral">{event.linkTypeLabel}</span>}
        {event.evidenceHash && <span className="evidence-label">Evidence hash recorded</span>}
      </div>
      <details className="event-details"><summary>Record details</summary>
        <p className="detail-context">{event.eventName} · Transaction index {event.transactionIndex} · Log {event.logIndex}</p>
        <HashValue label={`Transaction hash for event ${event.eventId}`} value={event.transactionHash} />
        {event.eventType && <HashValue label={`Event type for event ${event.eventId}`} value={event.eventType} />}
        {event.stateAfter && <HashValue label={`State hash for event ${event.eventId}`} value={event.stateAfter} />}
        {event.linkType && <HashValue label={`Link type for event ${event.eventId}`} value={event.linkType} />}
        {event.metadataHash && <HashValue label={`Metadata hash for event ${event.eventId}`} value={event.metadataHash} />}
        {event.evidenceHash && <HashValue label={`Evidence hash for event ${event.eventId}`} value={event.evidenceHash} />}
      </details>
    </article>
  </li>;
}

function ValidTrace({ tenantId, entityId }: { tenantId: string; entityId: string }) {
  const { state, refresh, loadMore, paging, pageError } = useTrace(tenantId, entityId);
  const wait = useRetryWait(pageError?.retryAt ?? 0);
  if (state.kind === "failed") return <Problem error={state.error} retry={refresh} />;
  if (state.kind === "loading") return <section className="loading-card" aria-busy="true" role="status">
    <span className="eyebrow">PUBLIC PROVENANCE</span><Heading>Opening your trace</Heading>
    <p>Looking up the published record and its history.</p>
    <div className="skeleton wide" /><div className="skeleton" /><div className="skeleton short" />
  </section>;
  const { entity, events, page } = state;
  return <div data-public-record>
    <div className="trace-heading">
      <div><div className="breadcrumbs"><Link href="/" prefetch={false}>Lookup</Link><span aria-hidden="true">/</span><span>Public record</span></div>
        <span className="eyebrow">A RECORDED JOURNEY</span>
        <Heading>{entity.entityTypeLabel ? `${entity.entityTypeLabel} provenance` : "Entity provenance"}</Heading>
        <p className="record-subtitle">An open view of this entity's published history.</p>
      </div>
      <button className="button secondary refresh" onClick={refresh}>↻ <span>Refresh record</span></button>
    </div>
    <section className="overview" aria-label="Current record overview">
      <div className="overview-status"><span className="field-label">Current state</span>
        <strong>{entity.currentStateLabel || shortId(entity.currentState)}</strong>
        <span className={`status-pill ${entity.closed ? "closed" : ""}`}><span aria-hidden="true" />{entity.closed ? "Closed entity" : "Open entity"}</span>
      </div>
      <div><span className="field-label">Current custodian</span><strong className="mono">{shortId(entity.currentCustodian)}</strong><span className="small-note">Organization identifier</span></div>
      <div><span className="field-label">Created</span><strong>{displayDate(entity.createdAt)}</strong><span className="small-note">Recorded date · UTC</span></div>
    </section>
    <div className="trace-grid">
      <section className="journey panel" aria-labelledby="journey-heading">
        <div className="section-heading"><div><span className="eyebrow">PROVENANCE</span><h2 id="journey-heading">Recorded journey</h2></div><span className="count-pill">{events.length} loaded</span></div>
        <p className="section-description">Public events, in the order they were recorded.</p>
        {events.length ? <ol className="timeline">{events.map(event => <TimelineEvent key={event.eventId} event={event} />)}</ol> :
          <div className="empty-history"><h3>No public history yet</h3><p>The entity is published, but no history events are available in this view.</p></div>}
        {pageError && <Problem error={pageError} retry={loadMore} inline />}
        {page.hasMore ? <div className="timeline-bottom"><button className="button secondary" onClick={loadMore} disabled={paging || wait > 0}>
          {paging ? "Loading more…" : wait > 0 ? `Load more in ${wait}s` : "Load more events"}
        </button><span role="status" className="sr-only">{paging ? "Loading the next page of events." : `${events.length} public events loaded.`}</span></div> :
          <p className="timeline-end">All currently available public events are loaded.</p>}
      </section>
      <aside className="record-sidebar">
        <section className="panel identity-panel" aria-labelledby="identity-heading">
          <span className="eyebrow">RECORD IDENTITY</span><h2 id="identity-heading">The details that connect it</h2>
          <HashValue label="Tenant ID" value={entity.tenantId} /><HashValue label="Entity ID" value={entity.entityId} />
          <HashValue label="Custodian ID" value={entity.currentCustodian} />
          <details className="identity-extra"><summary>More record details</summary>
            <HashValue label="Entity type hash" value={entity.entityType} />
            <HashValue label="Current state hash" value={entity.currentState} />
            <HashValue label="Current metadata hash" value={entity.metadataHash} />
            {entity.closedAt && <p className="small-note">Closed {displayDate(entity.closedAt)} · UTC</p>}
          </details>
        </section>
        <section className="reading-note"><span className="note-icon" aria-hidden="true">i</span><h2>Reading this record</h2>
          <p>This view contains information published for this entity. Some events and linked entities can remain private.</p>
          <p>Hashes reference recorded evidence. Document contents and physical authenticity are not verified by this page.</p>
        </section>
      </aside>
    </div>
  </div>;
}

export function TraceViewer({ tenantId, entityId }: { tenantId: string; entityId: string }) {
  const tenant = normalizeId(tenantId);
  const entity = normalizeId(entityId);
  if (!tenant || !entity) return <Problem error={new PublicApiError("invalid")} retry={() => {}} />;
  return <ValidTrace key={`${tenant}:${entity}`} tenantId={tenant} entityId={entity} />;
}

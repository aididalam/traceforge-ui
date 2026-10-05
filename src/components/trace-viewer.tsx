"use client";

import Link from "next/link";
import { useTrace } from "./use-trace";
import { displayDate, HashValue, Heading, Problem, shortId, useRetryWait } from "./display";
import { PublicApiError } from "../lib/public-client";
import { normalizeId } from "../lib/urls";
import type { TraceTarget } from "../lib/urls";
import type { PublicEvent } from "../lib/public-contract";
import { readableLabel } from "../lib/display-labels";

function TimelineEvent({ event, position }: { event: PublicEvent; position: number }) {
  const title = readableLabel(event.eventTypeLabel || event.eventName);
  return <li className="timeline-event">
    <span className="timeline-dot" aria-hidden="true" />
    <article>
      <div className="event-top"><span className="eyebrow">UPDATE {position}</span></div>
      <h3>{title}</h3>
      <div className="event-tags">
        {event.stateAfterLabel && <span className="tag">{readableLabel(event.stateAfterLabel)}</span>}
        {event.linkTypeLabel && <span className="tag neutral">{readableLabel(event.linkTypeLabel)}</span>}
        {event.evidenceHash && <span className="evidence-label">Supporting information recorded</span>}
      </div>
      <details className="event-details"><summary>Update references</summary>
        <p className="detail-context">Update reference: {event.eventId} · Record group: {event.blockNumber}</p>
        <p className="detail-context">{readableLabel(event.eventName)} · Entry {event.transactionIndex} · Position {event.logIndex}</p>
        <HashValue label={`Saved record reference for update ${position}`} value={event.transactionHash} />
        {event.eventType && <HashValue label={`Update category reference for update ${position}`} value={event.eventType} />}
        {event.stateAfter && <HashValue label={`Status reference for update ${position}`} value={event.stateAfter} />}
        {event.linkType && <HashValue label={`Connection type reference for update ${position}`} value={event.linkType} />}
        {event.metadataHash && <HashValue label={`Product information reference for update ${position}`} value={event.metadataHash} />}
        {event.evidenceHash && <HashValue label={`Supporting information reference for update ${position}`} value={event.evidenceHash} />}
      </details>
    </article>
  </li>;
}

function ValidTrace({ target }: { target: TraceTarget }) {
  const { state, refresh, loadMore, paging, pageError } = useTrace(target);
  const wait = useRetryWait(pageError?.retryAt ?? 0);
  if (state.kind === "failed") return <Problem error={state.error} retry={refresh} />;
  if (state.kind === "loading") return <section className="loading-card" aria-busy="true" role="status">
    <span className="eyebrow">PRODUCT TRACKING</span><Heading>Finding your product</Heading>
    <p>Checking the latest recorded status and shared history.</p>
    <div className="skeleton wide" /><div className="skeleton" /><div className="skeleton short" />
  </section>;
  const { entity, events, page } = state;
  return <div data-public-record>
    <div className="trace-heading">
      <div><div className="breadcrumbs"><Link href="/" prefetch={false}>Track a product</Link><span aria-hidden="true">/</span><span>Product details</span></div>
        <span className="eyebrow">YOUR PRODUCT'S JOURNEY</span>
        <Heading>{entity.entityTypeLabel ? `${readableLabel(entity.entityTypeLabel)} tracking` : "Product tracking"}</Heading>
        <p className="record-subtitle">The latest recorded status and updates shared for this product.</p>
      </div>
      <button className="button secondary refresh" onClick={refresh}>↻ <span>Refresh</span></button>
    </div>
    <section className="overview" aria-label="Current product overview">
      <div className="overview-status"><span className="field-label">Current status</span>
        <strong>{entity.currentStateLabel ? readableLabel(entity.currentStateLabel) : "Status name unavailable"}</strong>
        <span className={`status-pill ${entity.closed ? "closed" : ""}`}><span aria-hidden="true" />{entity.closed ? "Tracking closed" : "Tracking open"}</span>
      </div>
      <div><span className="field-label">Current holder</span><strong className="mono">{shortId(entity.currentCustodian)}</strong><span className="small-note">Name not available; reference shown.</span></div>
      <div><span className="field-label">Added to tracking</span><strong>{displayDate(entity.createdAt)}</strong><span className="small-note">Recorded date</span></div>
    </section>
    <div className="trace-grid">
      <section className="journey panel" aria-labelledby="journey-heading">
        <div className="section-heading"><div><span className="eyebrow">THE JOURNEY SO FAR</span><h2 id="journey-heading">Product history</h2></div><span className="count-pill">{events.length} updates shown</span></div>
        <p className="section-description">Updates shared for this product, in the order they were recorded.</p>
        {events.length ? <ol className="timeline">{events.map((event, index) => <TimelineEvent key={event.eventId} event={event} position={index + 1} />)}</ol> :
          <div className="empty-history"><h3>No updates yet</h3><p>The product is available to view, but no updates have been shared yet.</p></div>}
        {pageError && <Problem error={pageError} retry={loadMore} inline />}
        {page.hasMore ? <div className="timeline-bottom"><button className="button secondary" onClick={loadMore} disabled={paging || wait > 0}>
          {paging ? "Loading updates…" : wait > 0 ? `More updates in ${wait}s` : "Show more updates"}
        </button><span role="status" className="sr-only">{paging ? "Loading more updates." : `${events.length} updates shown.`}</span></div> :
          <p className="timeline-end">This is all the history currently shared for this product.</p>}
      </section>
      <aside className="record-sidebar">
        <section className="panel identity-panel" aria-labelledby="identity-heading">
          <span className="eyebrow">PRODUCT DETAILS</span><h2 id="identity-heading">Tracking information</h2>
          {"trackingId" in target && <HashValue label="Tracking ID" value={target.trackingId} />}
          <details className="identity-extra"><summary>Reference details</summary>
            <p className="small-note">These codes identify the saved product record and its updates.</p>
            <HashValue label="Workspace reference" value={entity.tenantId} />
            <HashValue label="Internal product reference" value={entity.entityId} />
            <HashValue label="Current holder reference" value={entity.currentCustodian} />
            <HashValue label="Product type reference" value={entity.entityType} />
            <HashValue label="Status reference" value={entity.currentState} />
            <HashValue label="Product information reference" value={entity.metadataHash} />
            <HashValue label="Recorded time reference" value={entity.createdAt} />
            {entity.closedAt && <><p className="small-note">Tracking closed on {displayDate(entity.closedAt)}.</p>
              <HashValue label="Tracking closed time reference" value={entity.closedAt} /></>}
          </details>
        </section>
        <section className="reading-note"><span className="note-icon" aria-hidden="true">i</span><h2>About this history</h2>
          <p>Only updates shared for everyone to see appear here. Other updates or related products may be kept private.</p>
          <p>Supporting information is listed by reference. Its documents are not shown here. This page does not independently check the product or the accuracy of recorded claims.</p>
        </section>
      </aside>
    </div>
  </div>;
}

export function TraceViewer(target: TraceTarget) {
  if ("trackingId" in target) {
    const trackingId = normalizeId(target.trackingId);
    if (!trackingId) return <Problem error={new PublicApiError("invalid")} retry={() => {}} />;
    return <ValidTrace key={`tracking:${trackingId}`} target={{ trackingId }} />;
  }
  const tenant = normalizeId(target.tenantId);
  const entity = normalizeId(target.entityId);
  if (!tenant || !entity) return <Problem error={new PublicApiError("invalid")} retry={() => {}} />;
  return <ValidTrace key={`${tenant}:${entity}`} target={{ tenantId: tenant, entityId: entity }} />;
}

"use client";

import Link from "next/link";
import { useTrace } from "./use-trace";
import { displayDate, HashValue, Heading, Problem, RecordedTime, CopyTrackingLink, useRetryWait } from "./display";
import { PublicApiError } from "../lib/public-client";
import { normalizeId, normalizeShortCode, shortPath } from "../lib/urls";
import type { TraceTarget } from "../lib/urls";
import type { PublicEvent, PublicOrganization } from "../lib/public-contract";
import { readableLabel } from "../lib/display-labels";
import { ProductMetadata, SupplyChainStatus } from "./product-information";

const businessName = (organization: PublicOrganization | null) => organization?.name || "Business name not shared";

function TimelineEvent({ event, position }: { event: PublicEvent; position: number }) {
  const title = readableLabel(event.eventName === "EntityClosed" ? event.eventName : event.eventTypeLabel || event.eventName);
  return <li className="timeline-event">
    <span className="timeline-dot" aria-hidden="true" />
    <article>
      <div className="event-top"><span className="eyebrow">Update {position}</span><span className="event-date"><RecordedTime value={event.occurredAt} /></span></div>
      <h3>{event.eventName === "EntityClosed" ? <SupplyChainStatus closed /> : title}</h3>
      {event.transfer ? <p className="event-business transfer-business">
        <span>{businessName(event.transfer.from)}</span><span aria-hidden="true">→</span><span className="sr-only">to</span><span>{businessName(event.transfer.to)}</span>
      </p> : event.organization && <p className="event-business">Recorded by <strong>{businessName(event.organization)}</strong></p>}
      <div className="event-tags">
        {event.stateAfterLabel && event.eventName !== "EntityClosed" && <span className="tag">{readableLabel(event.stateAfterLabel)}</span>}
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
        {event.occurredAt && <HashValue label={`Recorded time reference for update ${position}`} value={event.occurredAt} />}
        {event.organization && <HashValue label={`Business reference for update ${position}`} value={event.organization.id} />}
        {event.transfer?.from && <HashValue label={`Sending business reference for update ${position}`} value={event.transfer.from.id} />}
        {event.transfer?.to && <HashValue label={`Receiving business reference for update ${position}`} value={event.transfer.to.id} />}
      </details>
    </article>
  </li>;
}

function ValidTrace({ target }: { target: TraceTarget }) {
  const { state, refresh, loadMore, paging, pageError } = useTrace(target);
  const wait = useRetryWait(pageError?.retryAt ?? 0);
  if (state.kind === "failed") return <Problem error={state.error} retry={refresh} />;
  if (state.kind === "loading") return <section className="loading-card" aria-busy="true" role="status">
    <span className="eyebrow">Product tracking</span><Heading>Finding your product</Heading>
    <p>Checking the latest recorded status and shared history.</p>
    <div className="skeleton wide" /><div className="skeleton" /><div className="skeleton short" />
  </section>;
  const { entity, events, page } = state;
  return <div data-public-record>
    <div className="trace-heading">
      <div><div className="breadcrumbs"><Link href="/" prefetch={false}>Track a product</Link><span aria-hidden="true">/</span><span>Product details</span></div>
        <span className="eyebrow">Your product’s journey</span>
        <Heading>{entity.productInfo?.name || (entity.entityTypeLabel ? `${readableLabel(entity.entityTypeLabel)} tracking` : "Product tracking")}</Heading>
        <p className="record-subtitle">The latest recorded status and updates shared for this product.</p>
      </div>
      <button className="btn btn-outline-secondary refresh" onClick={refresh}>↻ <span>Refresh</span></button>
    </div>
    <section className="product-information panel" aria-labelledby="product-information-heading">
      <div className="section-heading"><div><span className="eyebrow">About this product</span><h2 id="product-information-heading">Product information</h2></div>
        {entity.entityTypeLabel && <span className="tag neutral">{readableLabel(entity.entityTypeLabel)}</span>}
      </div>
      {entity.productInfo ? <ProductMetadata product={entity.productInfo} /> : <p className="section-description">Product details have not been shared yet.</p>}
    </section>
    <section className="overview" aria-label="Current product overview">
      <div className="overview-status"><span className="field-label">Current status</span>
        <SupplyChainStatus closed={entity.closed} />
      </div>
      <div><span className="field-label">Current holder</span><strong>{businessName(entity.currentHolder)}</strong>
        <span className="small-note">{entity.currentHolder?.type ? entity.currentHolder.type : "Latest recorded holder"}</span></div>
      <div><span className="field-label">Added to tracking</span><strong className="overview-date"><RecordedTime value={entity.createdAt} /></strong><span className="small-note">Recorded date and time</span></div>
    </section>
    <div className="trace-grid">
      <section className="journey panel" aria-labelledby="journey-heading">
        <div className="section-heading"><div><span className="eyebrow">The journey so far</span><h2 id="journey-heading">Supply history</h2></div><span className="count-pill">{events.length} updates shown</span></div>
        <p className="section-description">When each update happened and which businesses were involved, in recorded order. Times are shown in UTC.</p>
        {events.length ? <ol className="timeline">{events.map((event, index) => <TimelineEvent key={event.eventId} event={event} position={index + 1} />)}</ol> :
          <div className="empty-history"><h3>No updates yet</h3><p>The product is available to view, but no updates have been shared yet.</p></div>}
        {pageError && <Problem error={pageError} retry={loadMore} inline />}
        {page.hasMore ? <div className="timeline-bottom"><button className="btn btn-outline-secondary" onClick={loadMore} disabled={paging || wait > 0}>
          {paging ? "Loading updates…" : wait > 0 ? `More updates in ${wait}s` : "Show more updates"}
        </button><span role="status" className="sr-only">{paging ? "Loading more updates." : `${events.length} updates shown.`}</span></div> :
          <p className="timeline-end">This is all the history currently shared for this product.</p>}
      </section>
      <aside className="record-sidebar">
        <section className="panel identity-panel" aria-labelledby="identity-heading">
          <span className="eyebrow">Product details</span><h2 id="identity-heading">Tracking information</h2>
          {"shortCode" in target ? <>
            <div className="short-tracking-code"><HashValue label="Tracking ID" value={target.shortCode} /></div>
            <CopyTrackingLink path={shortPath(target.shortCode)} />
          </> : "trackingId" in target && <HashValue label="Tracking ID" value={target.trackingId} />}
          <details className="identity-extra"><summary>Reference details</summary>
            <p className="small-note">These codes identify the saved product record and its updates.</p>
            {"shortCode" in target && state.trackingId && <HashValue label="Full tracking reference" value={state.trackingId} />}
            <HashValue label="Workspace reference" value={entity.tenantId} />
            <HashValue label="Internal product reference" value={entity.entityId} />
            <HashValue label="Current holder reference" value={entity.currentCustodian} />
            <HashValue label="Product type reference" value={entity.entityType} />
            <HashValue label="Status reference" value={entity.currentState} />
            <HashValue label="Product information reference" value={entity.metadataHash} />
            <HashValue label="Recorded time reference" value={entity.createdAt} />
            {entity.closedAt && <><p className="small-note">Left the supply chain on {displayDate(entity.closedAt)}.</p>
              <HashValue label="Departure time reference" value={entity.closedAt} /></>}
          </details>
        </section>
        <section className="reading-note"><span className="note-icon" aria-hidden="true">i</span><h2>About this history</h2>
          <p>Only updates shared for everyone to see appear here. Other updates or related products may be kept private.</p>
          <p>Product details and business names appear when shared by the business. Other supporting documents remain available by reference. This page does not independently check the product or the accuracy of recorded claims.</p>
        </section>
      </aside>
    </div>
  </div>;
}

export function TraceViewer(target: TraceTarget) {
  if ("shortCode" in target) {
    const shortCode = normalizeShortCode(target.shortCode);
    if (!shortCode) return <Problem error={new PublicApiError("invalid")} retry={() => {}} />;
    return <ValidTrace key={`short:${shortCode}`} target={{ shortCode }} />;
  }
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

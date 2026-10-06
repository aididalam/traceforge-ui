type ProductDetails = {
  name: string | null;
  description: string | null;
  fields: { label: string; value: string }[];
};

// Render decoded, shared metadata as text. Older product descriptions remain
// readable; new products use the same dynamic detail fields for any content.
export function ProductMetadata({ product }: { product: ProductDetails }) {
  const entries = [
    ...(product.name ? [{ label: "Product name", value: product.name }] : []),
    ...(product.description ? [{ label: "Description", value: product.description }] : []),
    ...product.fields,
  ];
  return entries.length ? <dl className="product-fields">{entries.map((field, index) =>
    <div key={index}><dt>{field.label}</dt><dd>{field.value}</dd></div>
  )}</dl> : <p className="section-description">No product details have been shared.</p>;
}

export function SupplyChainStatus({ closed }: { closed: boolean }) {
  return <span className={`badge supply-chain-status text-bg-${closed ? "info" : "success"}`}>
    {closed ? "Out of supply chain" : "In supply chain"}
  </span>;
}

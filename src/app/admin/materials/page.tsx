"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

type Grade = "ESSENTIAL" | "PREMIUM" | "LUXURY";
type Product = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  brand: string | null;
  grade: string | null;
  model: string | null;
  dimensions: string | null;
  unit: string;
  sellingPrice: string | null;
  wholesalePrice: string | null;
  stockQuantity: string | null;
  stockStatus: string;
  supplierId: string | null;
  images: string[];
  active: boolean;
  featured: boolean;
  quotationQuality: Grade;
  quotationActive: boolean;
};
type SupplierOption = { id: string; companyName: string };
type MaterialForm = {
  name: string;
  slug: string;
  category: string;
  description: string;
  brand: string;
  grade: string;
  model: string;
  dimensions: string;
  unit: string;
  sellingPrice: string;
  wholesalePrice: string;
  stockQuantity: string;
  stockStatus: string;
  supplierId: string;
  images: string[];
  featured: boolean;
  active: boolean;
  quotationQuality: Grade;
  quotationActive: boolean;
};

const blank: MaterialForm = {
  name: "",
  slug: "",
  category: "Cement",
  description: "",
  brand: "",
  grade: "",
  model: "",
  dimensions: "",
  unit: "bag",
  sellingPrice: "",
  wholesalePrice: "",
  stockQuantity: "",
  stockStatus: "ENQUIRY_ONLY",
  supplierId: "",
  images: [],
  featured: false,
  active: false,
  quotationQuality: "ESSENTIAL",
  quotationActive: true,
};

export default function MaterialsAdmin() {
  const [rows, setRows] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [productsResponse, suppliersResponse] = await Promise.all([
      fetch("/api/admin/materials", { cache: "no-store" }),
      fetch("/api/admin/suppliers", { cache: "no-store" }),
    ]);
    if (productsResponse.status === 401 || suppliersResponse.status === 401) {
      location.href = "/admin/login";
      return;
    }
    const [products, supplierOptions] = await Promise.all([
      productsResponse.json(),
      suppliersResponse.json(),
    ]);
    if (!productsResponse.ok) throw new Error(products.error || "Products could not be loaded.");
    if (!suppliersResponse.ok) throw new Error(supplierOptions.error || "Suppliers could not be loaded.");
    setRows(products);
    setSuppliers(supplierOptions);
  }

  useEffect(() => {
    load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Products could not be loaded."));
  }, []);

  function edit(product: Product) {
    setEditing(product.id);
    setForm({
      ...blank,
      name: product.name,
      slug: product.slug,
      category: product.category,
      description: product.description ?? "",
      brand: product.brand ?? "",
      grade: product.grade ?? "",
      model: product.model ?? "",
      dimensions: product.dimensions ?? "",
      unit: product.unit,
      sellingPrice: product.sellingPrice ?? "",
      wholesalePrice: product.wholesalePrice ?? "",
      stockQuantity: product.stockQuantity ?? "",
      stockStatus: product.stockStatus,
      supplierId: product.supplierId ?? "",
      images: product.images ?? [],
      featured: product.featured,
      active: product.active,
      quotationQuality: product.quotationQuality,
      quotationActive: product.quotationActive,
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const payload = {
      ...form,
      sellingPrice: form.sellingPrice ? Number(form.sellingPrice) : null,
      wholesalePrice: form.wholesalePrice ? Number(form.wholesalePrice) : null,
      stockQuantity: form.stockQuantity ? Number(form.stockQuantity) : null,
    };

    try {
      const response = await fetch("/api/admin/materials", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, ...(editing ? { id: editing } : {}) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Product could not be saved.");

      setForm(blank);
      setEditing("");
      setMessage(form.quotationActive
        ? "Product saved and linked to quotations. Configure its package rate under Quotations → Materials before selecting it in an estimate."
        : "Product saved. It is not currently available in quotations.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Product could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function archive(id: string) {
    if (!window.confirm("Archive this product from the public catalogue and quotations?")) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/materials?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Product could not be archived.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Product could not be archived.");
    }
  }

  return (
    <main className="admin-shell">
      <div className="admin-wrap">
        <header className="admin-header">
          <div>
            <div className="eyebrow">PROCUREMENT / CATALOGUE</div>
            <h1>Materials &amp; products</h1>
            <p>Product prices are for sales; quotation upgrade prices are configured separately per square foot.</p>
          </div>
          <Link className="btn btn-dark" href="/admin">Dashboard</Link>
        </header>

        <nav className="admin-links">
          <Link className="admin-link-card" href="/admin/suppliers"><strong>Suppliers</strong><small>Manage vendor records</small></Link>
          <Link className="admin-link-card" href="/admin/rates"><strong>Material rates</strong><small>Submit and approve rates</small></Link>
          <Link className="admin-link-card" href="/admin/quotations"><strong>Quotations</strong><small>Configure package pricing and product upgrade rates</small></Link>
          <Link className="admin-link-card" href="/materials"><strong>Public catalogue</strong><small>Preview customer view</small></Link>
        </nav>

        {error && <p className="notice notice-error" role="alert">{error}</p>}
        {message && <p className="notice" role="status">{message}</p>}

        <section className="admin-panel">
          <h2>{editing ? "Edit product" : "Add product"}</h2>
          <form className="admin-form" onSubmit={save}>
            <div className="form-grid">
              <label>Product name
                <input required value={form.name} onChange={(event) => setForm({
                  ...form,
                  name: event.target.value,
                  slug: event.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
                })} />
              </label>
              <label>Slug
                <input required value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
              </label>
              <label>Category
                <input required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
              </label>
              <label>Brand
                <input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
              </label>
              <label>Material grade
                <input value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })} />
              </label>
              <label>Quotation quality
                <select value={form.quotationQuality} onChange={(event) => setForm({ ...form, quotationQuality: event.target.value as Grade })}>
                  <option value="ESSENTIAL">Essential</option>
                  <option value="PREMIUM">Premium</option>
                  <option value="LUXURY">Luxury</option>
                </select>
              </label>
              <label>Model
                <input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} />
              </label>
              <label>Dimensions
                <input value={form.dimensions} onChange={(event) => setForm({ ...form, dimensions: event.target.value })} />
              </label>
              <label>Unit
                <input required value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} />
              </label>
              <label>Supplier
                <select value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })}>
                  <option value="">No supplier linked</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.companyName}</option>)}
                </select>
              </label>
              <label>Wholesale price (optional)
                <input type="number" min="0" step="0.01" value={form.wholesalePrice} onChange={(event) => setForm({ ...form, wholesalePrice: event.target.value })} />
              </label>
              <label>Stock quantity (optional)
                <input type="number" min="0" step="0.001" value={form.stockQuantity} onChange={(event) => setForm({ ...form, stockQuantity: event.target.value })} />
              </label>
              <label>Selling price (optional)
                <input type="number" min="0" step="0.01" value={form.sellingPrice} onChange={(event) => setForm({ ...form, sellingPrice: event.target.value })} />
              </label>
              <label>Stock status
                <select value={form.stockStatus} onChange={(event) => setForm({ ...form, stockStatus: event.target.value })}>
                  <option value="ENQUIRY_ONLY">Enquiry only</option>
                  <option value="IN_STOCK">In stock (verified)</option>
                  <option value="LIMITED">Limited (verified)</option>
                  <option value="OUT_OF_STOCK">Out of stock</option>
                </select>
              </label>
              <label>Image URLs (one per line)
                <textarea rows={2} value={form.images.join("\n")} onChange={(event) => setForm({
                  ...form,
                  images: event.target.value.split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
                })} />
              </label>
            </div>

            <label>Description
              <textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </label>
            <div className="form-checks">
              <label><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /> Featured</label>
              <label><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Publish publicly</label>
              <label><input type="checkbox" checked={form.quotationActive} onChange={(event) => setForm({ ...form, quotationActive: event.target.checked })} /> Available in quotations</label>
            </div>
            <div className="form-actions">
              <button className="btn btn-dark" disabled={busy}>{busy ? "Saving…" : editing ? "Update product" : "Create product"}</button>
              {editing && <button type="button" className="btn" onClick={() => { setEditing(""); setForm(blank); }}>Cancel</button>}
            </div>
          </form>
        </section>

        <section className="admin-panel">
          <h2>Product catalogue ({rows.length})</h2>
          <div className="table-scroll">
            <table className="admin-table">
              <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Visibility</th><th>Quotation</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}{product.brand ? ` · ${product.brand}` : ""}</td>
                    <td>{product.category}</td>
                    <td>{product.sellingPrice ? `₹${Number(product.sellingPrice).toLocaleString("en-IN")}` : "On enquiry"}</td>
                    <td>{product.active ? "Published" : "Draft"}</td>
                    <td>{product.quotationActive ? `${product.quotationQuality} · linked` : "Not available"}</td>
                    <td>
                      <button type="button" className="text-link" onClick={() => edit(product)}>Edit</button>
                      {" · "}
                      <button type="button" className="text-link" onClick={() => archive(product.id)}>Archive</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

/** Base public URL for this deployment (Render, local, etc.). */
export const getPublicBaseUrl = (req) => {
  const fromEnv =
    process.env.RENDER_EXTERNAL_URL ||
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_URL;

  if (fromEnv) return String(fromEnv).trim().replace(/\/$/, "");

  if (req) {
    const host = req.get("x-forwarded-host") || req.get("host");
    const proto = req.get("x-forwarded-proto") || req.protocol || "https";
    if (host) return `${proto}://${host}`.replace(/\/$/, "");
  }

  return "";
};

const extractRaw = (value) => {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const v = extractRaw(item);
      if (v) return v;
    }
    return null;
  }
  if (typeof value === "object") {
    return (
      value.secure_url ||
      value.url ||
      value.path ||
      value.Location ||
      extractRaw(value.image) ||
      null
    );
  }
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s || s === "[object Object]" || s === "no-photo.jpg") return null;
  return s;
};

/** Turn stored DB paths into browser-loadable URLs in production. */
export const resolveMediaUrl = (value, req) => {
  const raw = extractRaw(value);
  if (!raw) return null;

  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:")) {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(raw)) {
      const base = getPublicBaseUrl(req);
      if (base) return raw.replace(/^https?:\/\/[^/]+/i, base);
    }
    return raw;
  }

  if (raw.startsWith("//")) return `https:${raw}`;

  if (
    !raw.includes("/") &&
    process.env.CLOUDINARY_CLOUD_NAME &&
    !raw.startsWith(".")
  ) {
    return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${raw}`;
  }

  const base = getPublicBaseUrl(req);
  if (!base) return raw.startsWith("/") ? raw : `/${raw}`;

  const path = raw.replace(/\\/g, "/");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};

export const normalizeProductMedia = (product, req) => {
  if (!product || typeof product !== "object") return product;

  const next = { ...product };

  if (next.image) next.image = resolveMediaUrl(next.image, req) || next.image;

  if (Array.isArray(next.images)) {
    next.images = next.images.map((img) => {
      if (typeof img === "object" && img !== null) {
        const url = resolveMediaUrl(img.url || img.secure_url || img, req);
        return url ? { ...img, url } : img;
      }
      const url = resolveMediaUrl(img, req);
      return url || img;
    });
  }

  if (Array.isArray(next.variants)) {
    next.variants = next.variants.map((v) => ({
      ...v,
      image: v.image ? resolveMediaUrl(v.image, req) || v.image : v.image,
      images: Array.isArray(v.images)
        ? v.images.map((img) => resolveMediaUrl(img, req) || img)
        : v.images,
    }));
  }

  return next;
};

export const getMulterFileUrl = (file) =>
  file?.secure_url || file?.path || file?.url || null;

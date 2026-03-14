const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/$/, "");

export const buildApiUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!API_BASE) {
    return normalizedPath;
  }

  const normalizedBase =
    normalizedPath === "/api" || normalizedPath.startsWith("/api/")
      ? API_BASE.replace(/\/api$/i, "")
      : API_BASE;

  return `${normalizedBase}${normalizedPath}`;
};

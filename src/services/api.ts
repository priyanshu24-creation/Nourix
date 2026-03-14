const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/$/, "");

export const buildApiUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${normalizedPath}` : normalizedPath;
};

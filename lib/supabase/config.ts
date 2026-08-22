export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? "";

  let projectRef = "unknown";
  try {
    projectRef = new URL(url).hostname.split(".")[0] || projectRef;
  } catch {
    // Keep diagnostics safe when the environment URL is malformed.
  }

  return { url, key, projectRef };
}

/** Every piece of text interpolated into the HTML report (security names, sector labels, etc.) goes through this - avoids any injection/markup-breaking risk from upstream data (OWASP: never trust interpolated strings). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

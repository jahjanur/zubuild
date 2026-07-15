/**
 * Subtle "Powered by Zulbera" brand mark shown across the app (sidebar footer,
 * under page content on mobile, and the login page) — mirrors the PDF footer.
 * Fixed brand text (not translated); muted styling that adapts to both themes.
 */
export function PoweredBy({ className = '' }: { className?: string }) {
  return (
    <p className={`text-center text-[11px] leading-none text-app-muted ${className}`}>
      Powered by <span className="font-medium text-app-secondary">Zulbera</span>
    </p>
  );
}

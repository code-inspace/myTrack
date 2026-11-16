/**
 * The app shell is fixed and non-scrolling, so auth pages need their own scroll area. It leaves
 * room for the on-screen keyboard (--keyboard-height) so the focused field is never hidden.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
      style={{ paddingBottom: "var(--keyboard-height, 0px)" }}
    >
      {children}
    </div>
  );
}

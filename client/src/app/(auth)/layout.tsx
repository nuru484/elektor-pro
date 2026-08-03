// Auth pages render their own AuthShell (centered card over the fixed site
// background); the layout is a plain passthrough.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

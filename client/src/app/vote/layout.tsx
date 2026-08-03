// The voter portal's auth stages render the centered AuthShell; the
// elections/ballot views bring their own slim header. Plain passthrough.
export default function VoteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

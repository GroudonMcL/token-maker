/** Stand-in content for a section that is built in a later phase. */
export function SectionPlaceholder({ text }: { text: string }) {
  return (
    <div className="placeholder">
      <p>{text}</p>
      <span className="placeholder__badge">Coming soon</span>
    </div>
  );
}

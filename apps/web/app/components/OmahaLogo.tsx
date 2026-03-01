export default function OmahaLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M20 4L4 34h32L20 4z" fill="currentColor" opacity={0.9} />
      <path d="M20 4L12 34h16L20 4z" fill="currentColor" opacity={0.6} />
      <path d="M20 4L16 24h8L20 4z" fill="currentColor" opacity={0.3} />
    </svg>
  );
}

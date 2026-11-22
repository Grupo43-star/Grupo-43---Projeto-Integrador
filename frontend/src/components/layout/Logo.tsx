export default function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="4" fill="#f4f2ee" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#1f3b2f" strokeWidth="3" strokeDasharray="44 13" />
      <path d="M12.5 19.5c0-4 2.6-6.8 7-7.2-.3 4.4-3 7.2-7 7.2z" fill="#b0644a" />
    </svg>
  )
}

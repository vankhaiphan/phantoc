import Link from "next/link";
import config from "@/app/config";

export interface SiteHeaderProps {
  /** Subtitle shown under (or beside) the wordmark. e.g. "Sơ đồ phả hệ". */
  subtitle?: string;
  /** True when the request is from a signed-in user; toggles auth links. */
  authed: boolean;
  /** Pass true on /cay so we omit the redundant tree link. */
  hideTreeLink?: boolean;
  /** Pass true on /danh-xung so we omit the redundant kinship link. */
  hideKinshipLink?: boolean;
}

/**
 * Shared top bar used by /cay, /danh-xung, and any other page that needs the
 * wordmark + section subtitle + nav links. Mobile-first: the wordmark and
 * subtitle stack on small screens; nav links wrap below them.
 */
export default function SiteHeader({
  subtitle,
  authed,
  hideTreeLink,
  hideKinshipLink,
}: SiteHeaderProps) {
  return (
    <header
      className="px-4 sm:px-6 py-3 sm:py-4"
      style={{
        borderBottom: "1px solid rgba(26,23,20,0.08)",
        backgroundColor: "var(--color-parchment)",
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
      }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-3 min-w-0">
          <Link
            href="/"
            className="font-display text-xl whitespace-nowrap"
            style={{ color: "var(--color-ink)" }}
          >
            {config.siteName}
          </Link>
          {subtitle ? (
            <span
              className="font-serif italic text-sm hidden sm:inline truncate"
              style={{ color: "var(--color-sepia)" }}
            >
              {subtitle}
            </span>
          ) : null}
        </div>

        <nav className="flex items-center gap-x-4 gap-y-1 flex-wrap text-sm">
          {!hideTreeLink ? (
            <Link
              href="/cay"
              className="font-serif py-1"
              style={{ color: "var(--color-ink)", minHeight: 32 }}
            >
              Sơ đồ phả hệ
            </Link>
          ) : null}
          {!hideKinshipLink ? (
            <Link
              href="/danh-xung"
              className="font-serif py-1"
              style={{ color: "var(--color-ink)", minHeight: 32 }}
            >
              Tra cứu danh xưng
            </Link>
          ) : null}
          {authed ? (
            <Link
              href="/bang-dieu-khien"
              className="py-1"
              style={{ color: "var(--color-sepia)", minHeight: 32 }}
            >
              Bảng điều khiển
            </Link>
          ) : (
            <Link
              href="/dang-nhap"
              className="font-serif py-1"
              style={{ color: "var(--color-ink)", minHeight: 32 }}
            >
              Đăng nhập
            </Link>
          )}
        </nav>
      </div>

      {subtitle ? (
        <p
          className="font-serif italic text-xs sm:hidden mt-1"
          style={{ color: "var(--color-sepia)" }}
        >
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}

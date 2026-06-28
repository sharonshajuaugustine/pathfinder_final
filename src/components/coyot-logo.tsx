import Image from "next/image";

export function CoyotCIcon({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/coyot-c-icon.svg"
      alt="Coyot AI"
      width={size}
      height={size}
      style={{ objectFit: "contain" }}
      priority
    />
  );
}

export function CoyotBadge() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0" }}>
      <Image
        src="/coyot-c-icon.svg"
        alt="Coyot AI"
        width={16}
        height={16}
        style={{ objectFit: "contain" }}
      />
      <span style={{
        fontSize: 11,
        fontWeight: 700,
        color: "#1A3CC1",
        letterSpacing: "0.08em",
        fontFamily: "var(--font-heading)",
      }}>
        COYOT AI
      </span>
    </div>
  );
}

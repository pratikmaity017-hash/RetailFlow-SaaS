import "./skeleton.css";

export default function Skeleton({
  variant = "rect",
  width,
  height,
  className = "",
}) {
  return (
    <span
      className={`skeleton skeleton-${variant} ${className}`}
      style={{
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
      }}
      aria-hidden="true"
    />
  );
}

import { ImageResponse } from "next/og";

/**
 * Dynamic favicon route — disabled.
 *
 * Next.js picks `app/icon.{tsx,png,jpg,svg,ico}` and `app/favicon.ico`
 * over `public/favicon.ico`. We render a minimal 1×1 transparent PNG
 * here so the dynamic route exists but is invisible, and our static
 * `app/favicon.ico` + `public/favicon.ico` (the new Movbox brand
 * mark) are what the browser actually shows.
 */
export const size = { width: 1, height: 1 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", background: "transparent" }} />,
    { ...size }
  );
}

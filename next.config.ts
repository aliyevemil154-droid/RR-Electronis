import type { NextConfig } from "next";

// Only the explicit development preview permits embedding. Production keeps
// its frame protection even if a preview flag is accidentally retained.
const embeddedPreview =
  process.env.NODE_ENV !== "production" && process.env.WEB_PREVIEW === "1";
const previewHostnames = (process.env.PREVIEW_HOSTNAMES ?? "")
  .split(",")
  .map((hostname) => hostname.trim())
  .filter(Boolean);
for (const hostname of previewHostnames) {
  if (
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(
      hostname,
    )
  ) {
    throw new Error(
      "PREVIEW_HOSTNAMES must contain hostnames without schemes, ports, paths or wildcards.",
    );
  }
}

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1", ...previewHostnames],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          ...(embeddedPreview
            ? []
            : [{ key: "X-Frame-Options", value: "DENY" }]),
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default nextConfig;

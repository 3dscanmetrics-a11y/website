import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // PDFKit reads its built-in AFM font metrics at runtime. Keep the package
  // external so Next's file tracer includes js/data/*.afm in server output.
  serverExternalPackages: ['pdfkit'],
};

export default nextConfig;

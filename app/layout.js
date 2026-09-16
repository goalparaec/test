import "./globals.css";

export const metadata = {
  title: "APDCL Report Downloader",
  description: "Download APDCL RMS Daily Performance Reports into Supabase"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

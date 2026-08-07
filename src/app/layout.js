import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";
import ScreenShieldProvider from "@/app/components/ScreenShieldProvider";

export const metadata = {
  title: "CHC LIMS — Patient Management",
  description:
    "CHC Laboratory Information Management System — Register, search, and manage patient records with a modern clinical interface.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <style dangerouslySetInnerHTML={{ __html: `
          body {
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
          }
          input, textarea, [contenteditable="true"] {
            -webkit-user-select: text;
            -moz-user-select: text;
            -ms-user-select: text;
            user-select: text;
          }
        ` }} />
      </head>
      <body suppressHydrationWarning>
        <ScreenShieldProvider>
          {children}
        </ScreenShieldProvider>
      </body>
    </html>
  );
}

import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

export const metadata = {
  title: "LIMS — Patient Management",
  description:
    "Uthiram Laboratory Information Management System — Register, search, and manage patient records with a modern clinical interface.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";
import ThemeProvider from "@/app/components/ThemeProvider";

export const metadata = {
  title: "LIMS — Patient Management",
  description:
    "Uthiram Laboratory Information Management System — Register, search, and manage patient records with a modern clinical interface.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

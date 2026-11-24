import Link from "next/link";
import { asset } from "@/lib/content";
import "./globals.css";
export const metadata = {
  title: "صفحه پیدا نشد | Mehdi Eslami",
  robots: { index: false, follow: true },
};
export default function NotFound() {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <main className="not-found wrap">
          <img src={asset("/assets/logo.svg")} alt="" width="64" height="48" />
          <span>404</span>
          <h1>این صفحه پیدا نشد.</h1>
          <p>
            ممکن است نشانی تغییر کرده باشد یا نوشته‌ای با این آدرس وجود نداشته
            باشد.
          </p>
          <Link href="/">بازگشت به نوشته‌ها ←</Link>
        </main>
      </body>
    </html>
  );
}

import Link from "next/link";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { asset, homePath, siteURL, type Lang } from "@/lib/content";
import { Icon } from "./icons";
import "../app/globals.css";
const persianFont = localFont({
  src: [
    { path: "../public/assets/fonts/IRANSansX-Regular.woff2", weight: "400" },
    { path: "../public/assets/fonts/IRANSansX-Bold.woff2", weight: "700" },
  ],
  variable: "--font-persian",
  display: "swap",
});
export function metadataFor(lang: Lang): Metadata {
  const title =
    lang === "fa"
      ? "نوشته‌های مهدی اسلامی | وب، جاوا و اندروید"
      : "Mehdi Eslami — Notes on software";
  const description =
    lang === "fa"
      ? "یادداشت‌های مهدی اسلامی دربارهٔ برنامه‌نویسی، توسعهٔ وب، جاوا و اندروید؛ تجربه‌ها و راه‌حل‌هایی از مسیر ساخت نرم‌افزار."
      : "Notes by Mehdi Eslami on web development, Java, Android, and the things learned while building software.";
  return {
    metadataBase: new URL(siteURL),
    title: { default: title, template: "%s | Mehdi Eslami" },
    description,
    authors: [{ name: "Mehdi Eslami", url: "https://mehdieslami.ir/" }],
    alternates: {
      canonical: siteURL + homePath(lang),
      languages: {
        "fa-IR": siteURL + "/",
        en: siteURL + "/en/",
        "x-default": siteURL + "/",
      },
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: siteURL + homePath(lang),
      siteName: "Mehdi Eslami — Journal",
      locale: lang === "fa" ? "fa_IR" : "en_GB",
      images: [
        {
          url: siteURL + "/assets/social-cover.webp",
          width: 1200,
          height: 630,
          alt: "Mehdi Eslami",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [siteURL + "/assets/social-cover.webp"],
    },
    icons: { icon: asset("/assets/favicon.svg") },
    robots: { index: true, follow: true },
  };
}
export function Shell({ lang, children }: { lang: Lang; children: ReactNode }) {
  const fa = lang === "fa";
  return (
    <html lang={lang} dir={fa ? "rtl" : "ltr"}>
      <body className={persianFont.variable}>
        <a className="skip" href="#main">
          {fa ? "رفتن به محتوا" : "Skip to content"}
        </a>
        <div className="ambient" aria-hidden="true" />
        <header className="site-header wrap">
          <a
            href={fa ? "https://mehdieslami.ir/fa/" : "https://mehdieslami.ir/"}
            className="brand"
            aria-label={fa ? "وب‌سایت مهدی اسلامی" : "Mehdi Eslami website"}
          >
            <img
              src={asset("/assets/logo.svg")}
              width="52"
              height="40"
              alt=""
            />
            <span>
              {fa ? "مهدی اسلامی" : "MEHDI ESLAMI"}
              <small>
                {fa ? "یادداشت‌ها و تجربه‌ها" : "NOTES & EXPERIENCES"}
              </small>
            </span>
          </a>
          <nav aria-label={fa ? "منوی اصلی" : "Main navigation"}>
            <Link href={homePath(lang)}>
              {fa ? "نوشته‌ها" : "Journal"}
              <i />
            </Link>
            <a href="https://mehdieslami.ir/#work">
              {fa ? "نمونه‌کارها" : "Projects"}
            </a>
            <a href="https://mehdieslami.ir/#about">
              {fa ? "دربارهٔ من" : "About"}
            </a>
          </nav>
          <div className="header-actions">
            <a
              className="rss-icon"
              href={asset(`${fa ? "" : "/en"}/feed.xml`)}
              aria-label={fa ? "خوراک RSS فارسی" : "English RSS feed"}
            >
              <Icon name="rss" />
            </a>
            <Link
              className="language-button"
              href={homePath(fa ? "en" : "fa")}
              lang={fa ? "en" : "fa"}
            >
              {fa ? "EN" : "فارسی"}
            </Link>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="site-footer wrap">
          <div className="footer-top">
            <Link href={homePath(lang)} className="footer-brand">
              <img
                src={asset("/assets/logo.svg")}
                width="45"
                height="34"
                alt=""
              />
              {fa
                ? "اینجا از تجربه‌هایم می‌نویسم."
                : "A place to write things down."}
            </Link>
            <div>
              <a href="https://github.com/MehdiEslami1221">
                GitHub <Icon name="external" width="13" />
              </a>
              <a href="https://www.linkedin.com/in/mehdi-eslami/">
                LinkedIn <Icon name="external" width="13" />
              </a>
              <a href={asset(`${fa ? "" : "/en"}/feed.xml`)}>
                RSS <Icon name="rss" width="13" />
              </a>
            </div>
          </div>
          <div className="footer-bottom">
            <span>
              ©{" "}
              {new Intl.NumberFormat(lang, { useGrouping: false }).format(
                new Date().getUTCFullYear(),
              )}{" "}
              {fa ? "مهدی اسلامی" : "Mehdi Eslami"}
            </span>
            <a href="https://mehdieslami.ir/#contact">
              {fa ? "پروژه‌ای در نظر دارید؟" : "Have a project in mind?"}{" "}
              <Icon name="arrow" width="16" />
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}

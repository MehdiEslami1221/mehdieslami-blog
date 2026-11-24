import {
  listedPosts,
  asset,
  siteURL,
  homePath,
  type Lang,
} from "@/lib/content";
import { Journal } from "./journal";
import { Icon } from "./icons";
export function Home({ lang }: { lang: Lang }) {
  const fa = lang === "fa",
    posts = listedPosts(lang);
  const schema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": siteURL + "/#blog",
    name: fa ? "نوشته‌های مهدی اسلامی" : "Mehdi Eslami — Journal",
    url: siteURL + homePath(lang),
    inLanguage: lang,
    author: {
      "@type": "Person",
      "@id": "https://mehdieslami.ir/#me",
      name: "Mehdi Eslami",
      url: "https://mehdieslami.ir/",
    },
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
        }}
      />
      <section className="journal-hero wrap">
        <div className="hero-copy">
          <div className="eyebrow">
            <i />
            {fa ? "دفتر یادداشت یک توسعه‌دهنده" : "THE DEVELOPER’S NOTEBOOK"}
          </div>
          <h1>
            {fa ? (
              <>
                یادداشت‌های یک
                <br />
                <em>برنامه‌نویس.</em>
              </>
            ) : (
              <>
                Notes from
                <br />
                <em>behind the code.</em>
              </>
            )}
          </h1>
          <p className="hero-lead">
            {fa
              ? "دربارهٔ تجربه‌های ساخت وب، بک‌اند جاوا و اندروید می‌نویسم؛ چیزهایی که یاد می‌گیرم و راه‌حل‌هایی که در عمل امتحان می‌کنم."
              : "Thoughts on web development, Java and Android. Things I learn, problems I work through, and notes from the process."}
          </p>
          <a className="hero-link" href="#journal">
            {fa ? "سراغ نوشته‌ها برویم" : "Explore the journal"}
            <Icon name="arrow" />
          </a>
          <div className="hero-topics" dir="ltr">
            <span>WEB DEVELOPMENT</span>
            <b>✳</b>
            <span>JAVA / SPRING</span>
            <b>✳</b>
            <span>ANDROID</span>
          </div>
        </div>
        <div className="notebook-art" aria-hidden="true">
          <div className="art-corner">ME / JOURNAL</div>
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="art-core">
            <Icon name="book" width="64" height="64" />
          </div>
          <span className="orbit-code code-one">{"{ }"}</span>
          <span className="orbit-code code-two">{"</>"}</span>
          <span className="orbit-code code-three">{"01"}</span>
          <span className="art-caption">
            ideas. written down<span>→</span>
          </span>
          <div className="art-bottom">
            <span>
              {fa ? "یاد بگیر. بساز. بنویس." : "LEARN. BUILD. WRITE."}
            </span>
            <i />
          </div>
        </div>
      </section>
      <div className="wrap journal-layout">
        <section
          id="journal"
          className="journal-main"
          aria-labelledby="journal-title"
        >
          <div className="section-top">
            <div>
              <p className="eyebrow">
                {fa ? "از این دفتر" : "FROM THE JOURNAL"}
              </p>
              <h2 id="journal-title">
                {fa ? "تازه‌ترین نوشته‌ها" : "Recent writing"}
                <span>.</span>
              </h2>
            </div>
            <a
              className="feed-link"
              href={asset(`${fa ? "" : "/en"}/feed.xml`)}
            >
              <Icon name="rss" width="16" /> RSS
            </a>
          </div>
          <Journal lang={lang} posts={posts} />
        </section>
        <aside className="journal-aside">
          <div className="author-card">
            <p className="eyebrow">
              {fa ? "نویسندهٔ این دفتر" : "BEHIND THE NOTES"}
            </p>
            <div className="author-profile">
              <img
                src={asset("/assets/portrait.webp")}
                width="68"
                height="68"
                alt={fa ? "مهدی اسلامی" : "Mehdi Eslami"}
              />
              <div>
                <h3>{fa ? "مهدی اسلامی" : "Mehdi Eslami"}</h3>
                <span>
                  {fa ? "توسعه‌دهندهٔ نرم‌افزار" : "Software developer"}
                </span>
              </div>
            </div>
            <p>
              {fa
                ? "بیشتر با جاوا و Spring Boot کار می‌کنم. اینجا فرصتی است تا دربارهٔ تجربه‌های کار با کد و ساخت محصول بنویسم."
                : "I work mostly with Java and Spring Boot. This journal is a place to share what I learn about code and building software."}
            </p>
            <a href="https://mehdieslami.ir/#about">
              {fa ? "بیشتر دربارهٔ من" : "A little more about me"}
              <Icon name="arrow" width="16" />
            </a>
          </div>
          <div className="aside-note">
            <span className="note-mark">✳</span>
            <h3>
              {fa ? "برای خواندن، سر فرصت" : "For your next reading break"}
            </h3>
            <p>
              {fa
                ? "با RSS می‌توانید نوشته‌های تازه را در برنامهٔ خبرخوان خود دنبال کنید."
                : "Follow the RSS feed to read new posts in your favourite feed reader."}
            </p>
            <a href={asset(`${fa ? "" : "/en"}/feed.xml`)}>
              {fa ? "دنبال‌کردن با RSS" : "Follow via RSS"}
              <Icon name="rss" width="16" />
            </a>
          </div>
          <div className="aside-bottom" dir="ltr">
            BUILT WITH CURIOSITY <span>↗</span>
          </div>
        </aside>
      </div>
    </>
  );
}

import { isMainEntry } from "./shared/directory.ts";

/** @typedef {import("./shared/types.ts").ManifestEntry} ManifestEntry */
/** @typedef {import("./render/lib/jsx.ts").Child} Child */

/**
 * # 主页
 * @routable
 * @date 2026-11-01
 * @param {ShadowRoot} shadow
 */
export default function (shadow) {
  const host = /** @type {HTMLElement & {
   *   entries?: ManifestEntry[];
   *   site?: import("./shared/types.ts").SiteConfig;
   * }} */ (shadow.host);

  const site = host.site;
  const recent = (host.entries ?? [])
    .filter((entry) => !isMainEntry(entry.file))
    .slice(0, recentCount);

  return (
    <>
      <link rel="stylesheet" href="/components/home.css" />
      <div className="hero">
        <div className="hero-main">
          <AcrylicCard>
            <header className="profile">
              <img
                className="avatar"
                src="/imgs/avatar.png"
                alt={site?.author ?? "avatar"}
                width="56"
                height="56"
              />
              <div className="profile-text">
                <h1>{site?.author ?? "hi"}</h1>
                <p>{site?.description ?? ""}</p>
              </div>
            </header>
            <fluent-divider></fluent-divider>
            <Recent entries={recent} />
            <nav className="links" aria-label="links">
              {links.map((link) => (
                <fluent-link
                  href={link.href}
                  data-raw={link.raw ? "" : null}
                  target={link.external ? "_blank" : null}
                  rel={link.external ? "noopener" : null}
                >
                  {link.label}
                </fluent-link>
              ))}
            </nav>
          </AcrylicCard>
        </div>
        <div className="hero-back">
          <TiltWindow>
            <CodeCard file="cheese233.txt" lines={banner}>
              <div className="code-extra">
                <jsx-loader path="/components/kipfel.jsx"></jsx-loader>
              </div>
            </CodeCard>
          </TiltWindow>
        </div>
      </div>
      <Credits />
    </>
  );
}

/** Third-party asset notice for the Kipfel model on this page. */
const kipfelCredit = {
  model: "https://booth.pm/ja/items/5813187",
  license: "https://mochiyama.com/license_en",
};

const Credits = () => (
  <footer className="home-credits">
    <p>
      3D 模型「
      <fluent-link
        href={kipfelCredit.model}
        target="_blank"
        rel="noopener"
      >
        キプフェル Kipfel
      </fluent-link>
      」© もち山金魚 (Mochiyama Kingyo)。
    </p>
    <p>
      仅限个人使用，依照
      <fluent-link
        href={kipfelCredit.license}
        target="_blank"
        rel="noopener"
      >
        もち山金魚 利用规约
      </fluent-link>
      ；不适用本站的 MIT / CC BY-SA 许可。
    </p>
  </footer>
);

const recentCount = 5;

const links = [
  { label: "README", href: "/README", raw: false, external: false },
  { label: "Atom", href: "/atom.xml", raw: true, external: false },
  {
    label: "GitHub",
    href: "https://github.com/cheese233",
    raw: false,
    external: true,
  },
];

const banner = [
  "       _                             ____   _____  _____ ",
  "  ___ | |__    ___   ___  ___   ___ |___ \\ |___ / |___ / ",
  " / __|| '_ \\  / _ \\ / _ \\/ __| / _ \\  __) |  |_ \\   |_ \\ ",
  "| (__ | | | ||  __/|  __/\\__ \\|  __/ / __/  ___) | ___) |",
  " \\___||_| |_| \\___| \\___||___/ \\___||_____||____/ |____/ ",
  "",
  "  ~ under construction ~",
];

/** Maximum tilt in degrees, split across both axes. */
const tiltRange = 12;

/** @param {{ children?: Child[] }} props */
const AcrylicCard = ({ children }) => (
  <section className="acrylic">{children}</section>
);

/** @param {{ entries: ManifestEntry[] }} props */
const Recent = ({ entries }) => (
  <section className="recent" aria-labelledby="recent-title">
    <h2 id="recent-title">最近更新</h2>
    {entries.length
      ? (
        <ol>
          {entries.map((entry) => (
            <li>
              <fluent-link href={entry.route}>{entry.title}</fluent-link>
              <time datetime={entry.date}>{entry.date.slice(0, 10)}</time>
            </li>
          ))}
        </ol>
      )
      : <p className="empty">这里还没有内容。</p>}
  </section>
);

/**
 * Perspective tilt that follows the pointer. Skipped entirely when the
 * reader prefers reduced motion.
 * @param {HTMLElement} element
 */
const tilt = (element) => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  /** @param {string} transform @param {number} duration @param {string} easing */
  const animate = (transform, duration, easing) =>
    element.animate([{ transform }], {
      duration,
      easing,
      fill: "forwards",
    });

  element.addEventListener("pointermove", (event) => {
    if (event.pointerType != "mouse") return;
    const box = element.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    const rotateY = (tiltRange / 2 - x * tiltRange).toFixed(2);
    const rotateX = (y * tiltRange - tiltRange / 2).toFixed(2);
    animate(
      `perspective(${box.width}px) rotateX(${rotateX}deg) ` +
        `rotateY(${rotateY}deg)`,
      300,
      "ease-out",
    );
  });

  element.addEventListener("pointerleave", () => {
    animate(
      `perspective(${element.clientWidth}px) rotateX(0deg) rotateY(0deg)`,
      600,
      "cubic-bezier(0.34, 1.56, 0.64, 1)",
    );
  });
};

/** @param {{ children?: Child[] }} props */
const TiltWindow = ({ children }) => (
  <div className="window" ref={tilt}>{children}</div>
);

/**
 * GitHub-like file view: header with Code/Blame tabs, line-number gutter.
 * @param {{ file: string; lines: string[]; children?: Child[] }} props
 */
const CodeCard = ({ file, lines, children }) => (
  <figure className="code-card" aria-label={file}>
    <div className="code-meta">
      <span className="code-tab">{file}</span>
      <span>
        {lines.length} lines · {new Blob([lines.join("\n")]).size} Bytes
      </span>
    </div>
    <div className="code-toolbar">
      <span className="code-switch">
        <span className="code-switch-on">Code</span>
        <span>Blame</span>
      </span>
      <span className="code-dots" aria-hidden="true">⋯</span>
    </div>
    <div className="code-body">
      <pre className="code-lines" aria-hidden="true">
        {lines.map((_, index) => `${index + 1}\n`)}
      </pre>
      <pre className="code-text">{lines.join("\n")}</pre>
      {children}
    </div>
  </figure>
);

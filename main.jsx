import { isMainEntry } from "./shared/directory.ts";

/** @typedef {import("./shared/types.ts").ManifestEntry} ManifestEntry */
/** @typedef {import("./render/lib/jsx.ts").Child} Child */

/**
 * # 主页
 * @date 2026-11-01
 * @footer 3D 模型 [キプフェル Kipfel](https://booth.pm/ja/items/5813187) © もち山金魚
 * @footer 仅限个人使用，见 [利用规约](https://mochiyama.com/license_en)；不适用本站许可
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
          <CodeCard file="kipfel.jsx">
            <div className="code-extra">
              <jsx-loader path="/components/kipfel.jsx"></jsx-loader>
            </div>
          </CodeCard>
        </div>
      </div>
    </>
  );
}
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
 * GitHub-like file view: file name header and Code/Blame tabs; the body is
 * whatever component is embedded.
 * @param {{ file: string; children?: Child[] }} props
 */
const CodeCard = ({ file, children }) => (
  <figure className="code-card" aria-label={file}>
    <div className="code-meta">
      <span className="code-tab">{file}</span>
    </div>
    <div className="code-toolbar">
      <span className="code-switch">
        <span className="code-switch-on">Code</span>
        <span>Blame</span>
      </span>
      <span className="code-dots" aria-hidden="true">⋯</span>
    </div>
    <div className="code-body">{children}</div>

  </figure>
);

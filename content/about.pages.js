/**
 * # 关于
 * @date 2026-10-18
 * @author cheese233
 * @tags ["meta"]
 * @param {ShadowRoot} shadow
 */
export default function (shadow) {
  const article = document.createElement("article");
  article.className = "markdown";
  article.innerHTML = `
    <h1>关于</h1>
    <p>
      这里是 <strong>cheese233</strong> 的博客。页面由浏览器根据源文件实时生成，
      构建期只负责产出元数据。
    </p>
    <p>
      这个页面本身是 <code>content/about.pages.js</code>，扩展名是
      <code>pages.js</code>，因此由 <code>pages.js.ext.js</code> 处理；
      而后者又是由 <code>js.ext.js</code> 执行起来的。
    </p>
    <ul>
      <li><a href="/">全部文章</a></li>
      <li><a href="/posts/adapter-chain">adapter 链</a></li>
      <li><a href="/atom.xml" data-raw>Atom</a></li>
      <li><a href="/feed.json" data-raw>JSON Feed</a></li>
    </ul>
    <p>
      源码在
      <a href="https://codeberg.org/cheese233/articles" rel="noopener">
        Codeberg
      </a>。
    </p>
  `;
  shadow.append(article);
}

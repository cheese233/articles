import WebElements from "../adapters/js.ext.js";

/**
 * # 关于
 * @date 2026-10-18
 * @author cheese233
 * @tags ["meta"]
 */
export default class AboutPage extends WebElements {
  async connectedCallback() {
    this.classList.add("markdown");
    this.innerHTML = `
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
      <p>
        类继承自 <code>WebElements</code>。挂载这个 Web Component 就是渲染，
        没有额外的 <code>module()</code> 或 <code>render()</code> 阶段。
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
  }
}

/**
 * # JS 游乐场
 * @routable
 * @date 2026-10-19
 * @tags ["demo", "js"]
 * @param {ShadowRoot} shadow
 */
export default function (shadow) {
  const article = document.createElement("article");
  article.className = "markdown";
  article.innerHTML = `
    <h1>JS 游乐场</h1>
    <p>
      这篇内容是一个 <code>.js</code> 文件。它的默认导出是一个函数，
      由 <code>pages.js</code> 适配器调用，参数是当前页面的 ShadowRoot；
      <code>js.ext.js</code> 只负责加载。
    </p>
    <p>
      <button type="button">点我</button>
      <span class="counter">还没有点过。</span>
    </p>
    <p>
      下面这段逻辑完全运行在你的浏览器里，没有经过服务端渲染。
    </p>
  `;

  const button = article.querySelector("button");
  const counter = article.querySelector(".counter");
  let count = 0;

  if (button && counter) {
    button.addEventListener("click", () => {
      count += 1;
      counter.textContent = `你点了 ${count} 次。`;
    });
  }

  shadow.append(article);
}

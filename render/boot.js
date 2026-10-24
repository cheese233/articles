/**
 * @param {unknown} error
 */
const fail = (error) => {
  console.error(error);
  document.body.classList.remove("is-loading");

  const main = document.querySelector("#main");
  if (!main) return;

  const box = document.createElement("div");
  box.className = "fatal";

  const title = document.createElement("h1");
  title.textContent = "客户端 TypeScript 运行时加载失败";

  const message = document.createElement("pre");
  message.textContent = error instanceof Error ? error.message : String(error);

  box.append(title, message);
  main.replaceChildren(box);
};

/**
 * @param {number} timeout
 */
const waitForController = async (timeout) => {
  if (navigator.serviceWorker.controller) return true;

  return await new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(false), timeout);
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        window.clearTimeout(timer);
        resolve(true);
      },
      { once: true },
    );
  });
};

const boot = async () => {
  if (!("serviceWorker" in navigator))
    throw new Error("此浏览器不支持 Service Worker，无法执行客户端 TypeScript");

  const registration = await navigator.serviceWorker.register("/sw.js", {
    type: "module",
    updateViaCache: "none",
  });

  let readyTimer = 0;
  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => {
      readyTimer = window.setTimeout(
        () => reject(new Error("Service Worker 注册超时")),
        15000,
      );
    }),
  ]);
  window.clearTimeout(readyTimer);

  // A hard reload may bypass the service worker for the navigation. Ask the
  // active worker to claim this page; fall back to one normal reload.
  if (!(await waitForController(3000))) {
    registration.active?.postMessage("claim");
    if (!(await waitForController(2000))) {
      if (!sessionStorage.getItem("ts-sw-reload")) {
        sessionStorage.setItem("ts-sw-reload", "1");
        location.reload();
        return;
      }
      throw new Error("Service Worker 没有接管当前页面");
    }
  }

  sessionStorage.removeItem("ts-sw-reload");
  await import("./app.ts");
};

document.body.classList.add("is-loading");
await boot().catch(fail);

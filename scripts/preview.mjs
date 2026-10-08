import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const openBrowser = args.includes("--open");
const portArgument = args.indexOf("--port");
const portText = portArgument >= 0 ? args[portArgument + 1] : "3000";
const allowedArguments = args.filter(
  (_, index) => index !== portArgument + 1 || portArgument < 0,
);
if (
  allowedArguments.some((arg) => arg !== "--open" && arg !== "--port") ||
  !/^\d+$/.test(portText ?? "") ||
  Number(portText) < 1024 ||
  Number(portText) > 65535
) {
  console.error("Usage: npm run preview -- [--open] [--port 3000]");
  process.exit(1);
}
if (process.versions.node.split(".")[0] !== "24") {
  console.error(
    "Dubai Electronics requires Node.js 24. On Windows, use start-windows.cmd.",
  );
  process.exit(1);
}

const siteUrl = `http://localhost:${Number(portText)}`;
let serverExited = false;
let stopping = false;

async function isStorefrontReady() {
  try {
    const response = await fetch(siteUrl, {
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return false;
    const html = await response.text();
    return (
      html.includes("Dubai Electronics") && html.includes("Your next upgrade")
    );
  } catch {
    return false;
  }
}

function openSite() {
  let browser;
  if (process.platform === "win32") {
    // The URL contains only a fixed host and a validated numeric port.
    browser = spawn("cmd.exe", ["/d", "/s", "/c", `start "" "${siteUrl}"`], {
      stdio: "ignore",
      windowsVerbatimArguments: true,
    });
  } else if (process.platform === "darwin") {
    browser = spawn("open", [siteUrl], { stdio: "ignore" });
  } else {
    browser = spawn("xdg-open", [siteUrl], { stdio: "ignore" });
  }
  browser.on("error", () =>
    console.error(`Open ${siteUrl} in your browser. The server is running.`),
  );
  browser.on("exit", (code) => {
    if (code && code !== 0)
      console.error(`Open ${siteUrl} in your browser. The server is running.`);
  });
}

if (openBrowser && (await isStorefrontReady())) {
  console.log("Dubai Electronics is already running. Opening your browser.");
  openSite();
} else {
  console.log(
    "Starting Dubai Electronics. Keep this window open while using the site.",
  );
  const server = spawn(
    process.execPath,
    [
      resolve(root, "node_modules/next/dist/bin/next"),
      "dev",
      "--hostname",
      "0.0.0.0",
      "--port",
      String(Number(portText)),
    ],
    {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: "development",
        WEB_PREVIEW: "1",
        PAYMENT_PROVIDER: "",
      },
    },
  );
  server.on("error", (error) => {
    serverExited = true;
    console.error(
      `Could not start the site: ${error.message}. Run npm ci first.`,
    );
    process.exitCode = 1;
  });
  server.on("exit", (code, signal) => {
    serverExited = true;
    if (!process.exitCode) {
      process.exitCode =
        stopping || signal === "SIGINT" || signal === "SIGTERM"
          ? 0
          : (code ?? 1);
    }
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      stopping = true;
      server.kill(signal);
    });
  }
  if (openBrowser) {
    let ready = false;
    for (
      let attempt = 0;
      attempt < 90 && !serverExited && !stopping;
      attempt++
    ) {
      ready = await isStorefrontReady();
      if (ready) break;
      await delay(1000);
    }
    if (ready && !serverExited && !stopping) {
      console.log(
        `Dubai Electronics is ready at ${siteUrl}. Opening your browser.`,
      );
      openSite();
    } else if (!serverExited && !stopping) {
      console.error(
        "The site did not become ready. Check the server output above. The browser has not been opened.",
      );
      server.kill("SIGTERM");
      process.exitCode = 1;
    }
  }
}

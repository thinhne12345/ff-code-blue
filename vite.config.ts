import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const PLACEHOLDER_DATABASE_ID = "00000000-0000-4000-8000-000000000000";
const isSitesBuild = process.env.SITES_BUILD === "1";

export default defineConfig(async () => {
  const plugins = [vinext()];

  if (isSitesBuild) {
    process.env.WRANGLER_WRITE_LOGS ??= "false";
    process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
    process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";
    const { cloudflare } = await import("@cloudflare/vite-plugin");
    plugins.push(
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: {
          main: "./worker/index.ts",
          compatibility_flags: ["nodejs_compat"],
          d1_databases: hostingConfig.d1
            ? [
                {
                  binding: hostingConfig.d1,
                  database_name: "ff-code-blue-db",
                  database_id: PLACEHOLDER_DATABASE_ID,
                },
              ]
            : [],
        },
      }),
    );
  }

  return {
    plugins,
    server: { host: "0.0.0.0" },
    build: {
      rolldownOptions: {
        external: ["pg"],
      },
    },
  };
});

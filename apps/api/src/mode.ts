import { buildProviders, hasLiveMarketProvider } from "@alphatape/providers";

export function isDemoMode(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.DATA_MODE === "demo") return true;
  if (env.DATA_MODE === "live") return false;
  return !hasLiveMarketProvider(env);
}

export function providerStatus(env: NodeJS.ProcessEnv = process.env) {
  return buildProviders(env).map((provider) => ({
    id: provider.id,
    name: provider.displayName,
    configured: provider.configured,
    official: provider.official,
    disabledReason: provider.disabledReason,
    taseSupport: provider.taseSupport,
    taseNotes: provider.taseNotes,
    docsUrl: provider.docsUrl,
    capabilities: provider.capabilities,
  }));
}

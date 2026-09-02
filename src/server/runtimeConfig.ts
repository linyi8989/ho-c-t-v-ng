import path from "node:path";

export function resolvePersistentDirectory(options: {
  env: NodeJS.ProcessEnv;
  variable: "TTS_AUDIO_DIR" | "LISTENING_MEDIA_DIR";
  localDirectory: string;
  cwd?: string;
}) {
  const configured = options.env[options.variable]?.trim();
  if (configured) return path.resolve(configured);
  if (options.env.NODE_ENV === "production") {
    throw new Error(`${options.variable} is required in production.`);
  }
  return path.resolve(options.cwd || process.cwd(), ".data", options.localDirectory);
}

export function resolveDevQuotaApiKey(env: NodeJS.ProcessEnv, warn: (message: string) => void = console.warn) {
  const configured = env.DEVQUOTA_API_KEY?.trim();
  if (configured) return configured;
  const legacy = env.DEVQUOTA_API_KEYk?.trim();
  if (legacy) {
    warn("[Config] DEVQUOTA_API_KEYk is deprecated; rename it to DEVQUOTA_API_KEY.");
    return legacy;
  }
  return "";
}

let Schema: any = null;
try { ({ default: Schema } = await import("@deepseek-ai/schemastery" as any)); } catch {}
export function buildConfig(z: any) {
  return z.object({
    hub: z.string().default("https://remote.zhuhedong.cn").description("Hub 地址"),
    instanceName: z.string().default("").description("实例名称（留空用主机名，登记时生效）"),
    autoConnect: z.boolean().default(true).description("DSH 启动时自动连接 Hub"),
    proxy: z.string().default("system").description("代理：system（环境变量/系统代理，如 Clash）| direct | http://127.0.0.1:7890"),
    manageTrustedHosts: z.boolean().default(true).description("自动把本机访问域名加入 DSH trustedHosts"),
    keyStore: z.union([z.const("auto"), z.const("file")]).default("auto").description("设备密钥存储：auto（macOS 钥匙串，失败用加密文件）| file"),
  }).description("DSH 远程管理 · 连接到自建 Hub");
}
export const Config = Schema ? buildConfig(Schema) : undefined;

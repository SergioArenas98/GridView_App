// Minimal typing for Vite/Vitest's `import.meta.glob`, used by the contract
// tests to load every fixture from disk.
interface ImportMeta {
  glob(
    pattern: string,
    options: { eager: true },
  ): Record<string, { default: unknown }>;
}

declare module '*.toml?raw' {
  const content: string;
  export default content;
}

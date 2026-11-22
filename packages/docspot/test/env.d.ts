// Vite loads the stylesheet; it has no exports to type.
declare module '*.css';

declare module '*.css?raw' {
  const source: string;
  export default source;
}

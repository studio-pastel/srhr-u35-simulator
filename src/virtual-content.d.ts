declare module 'virtual:content' {
  import type { Content } from './engine/schema';
  const content: Content;
  export default content;
  /** verified: false で、確率ノード・統計カードから参照されている統計ID */
  export const unverifiedStats: string[];
}

/** ビルドした日（YYYY-MM-DD） */
declare const __BUILD_DATE__: string;

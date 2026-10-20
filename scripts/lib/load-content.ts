// content/ の YAML を読み、検証前の生データを返す（Node 専用）。
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';

export const CONTENT_DIR = resolve(import.meta.dirname, '../../content');

function readYaml(file: string): unknown {
  try {
    return parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`YAMLを読めません：${file}：${(err as Error).message}`);
  }
}

/** 読み込んだファイルの一覧（Vite の再読み込みに使う） */
export function contentFiles(dir = CONTENT_DIR): string[] {
  const top = ['config.yaml', 'characters.yaml', 'conditions.yaml', 'stats.yaml', 'resources.yaml', 'cast.yaml'].map((f) => join(dir, f));
  const chDir = join(dir, 'chapters');
  const chapters = existsSync(chDir)
    ? readdirSync(chDir)
        .filter((f) => f.endsWith('.yaml'))
        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
        .map((f) => join(chDir, f))
    : [];
  return [...top, ...chapters];
}

export function loadRawContent(dir = CONTENT_DIR): Record<string, unknown> {
  const chDir = join(dir, 'chapters');
  return {
    config: readYaml(join(dir, 'config.yaml')),
    characters: readYaml(join(dir, 'characters.yaml')),
    conditions: readYaml(join(dir, 'conditions.yaml')),
    stats: readYaml(join(dir, 'stats.yaml')),
    resources: readYaml(join(dir, 'resources.yaml')),
    cast: readYaml(join(dir, 'cast.yaml')),
    chapters: contentFiles(dir)
      .filter((f) => f.startsWith(chDir))
      .map(readYaml),
  };
}

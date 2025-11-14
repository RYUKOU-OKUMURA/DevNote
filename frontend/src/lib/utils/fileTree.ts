import type { FileNode } from '@shared/types';

/**
 * フラットなファイルパスの配列を階層的なツリー構造に変換する
 * @param filePaths ファイルパスの配列（例: ["src/main.ts", "src/utils/helper.ts"]）
 * @returns ルートノードを含むFileNodeの配列
 */
export function buildFileTree(filePaths: string[]): FileNode[] {
  const root: Map<string, FileNode> = new Map();

  // .gitディレクトリを除外し、パスを正規化
  const filteredPaths = filePaths
    .filter((path) => !path.startsWith('.git/') && !path.includes('/.git/'))
    .sort();

  for (const filePath of filteredPaths) {
    const parts = filePath.split('/');
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      if (!currentLevel.has(part)) {
        const node: FileNode = {
          path: currentPath,
          name: part,
          type: isFile ? 'file' : 'directory',
          children: isFile ? undefined : [],
        };
        currentLevel.set(part, node);
      }

      // ディレクトリの場合、次のレベルに進む
      if (!isFile) {
        const node = currentLevel.get(part)!;
        if (!node.children) {
          node.children = [];
        }
        // 子ノードのMapを作成
        const childrenMap = new Map<string, FileNode>();
        for (const child of node.children) {
          childrenMap.set(child.name, child);
        }
        currentLevel = childrenMap;
      }
    }
  }

  // ルートレベルのノードを配列として返す
  const result = Array.from(root.values());

  // ディレクトリを先に、ファイルを後にソート
  return sortFileTree(result);
}

/**
 * ファイルツリーをソートする（ディレクトリが先、ファイルが後）
 * @param nodes ソートするノード配列
 * @returns ソート済みのノード配列
 */
function sortFileTree(nodes: FileNode[]): FileNode[] {
  return nodes.sort((a, b) => {
    // ディレクトリを先に表示
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    // 同じタイプの場合は名前でソート
    return a.name.localeCompare(b.name);
  });
}

/**
 * ファイルツリーを再帰的にソートする
 * @param nodes ソートするノード配列
 * @returns ソート済みのノード配列
 */
export function sortFileTreeRecursive(nodes: FileNode[]): FileNode[] {
  const sorted = sortFileTree(nodes);
  for (const node of sorted) {
    if (node.children) {
      node.children = sortFileTreeRecursive(node.children);
    }
  }
  return sorted;
}

/**
 * モックデータ：開発用のサンプルファイルツリー
 */
export function getMockFileTree(): FileNode[] {
  return buildFileTree([
    'README.md',
    'package.json',
    'src/main.ts',
    'src/App.tsx',
    'src/components/Button.tsx',
    'src/components/Input.tsx',
    'src/utils/helper.ts',
    'src/utils/validator.ts',
    'tests/unit/helper.test.ts',
    'tests/integration/app.test.ts',
  ]);
}

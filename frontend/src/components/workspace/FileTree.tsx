import { useState, useEffect } from 'react';
import type { FileNode } from '@shared/types';
import { getMockFileTree } from '@/lib/utils/fileTree';
import './FileTree.css';

export interface FileTreeProps {
  /**
   * ノートID（将来的にAPIからファイルリストを取得する際に使用）
   */
  noteId?: string;
  /**
   * ファイル選択時のコールバック
   * @param filePath 選択されたファイルのパス（nullの場合は選択解除）
   */
  onFileSelect?: (filePath: string | null) => void;
  /**
   * 現在選択中のファイルパス
   */
  selectedFile?: string | null;
}

/**
 * ファイルツリーコンポーネント
 * ディレクトリツリーを展開/折りたたみ可能にし、ファイル選択を管理する
 */
export function FileTree({
  noteId,
  onFileSelect,
  selectedFile,
}: FileTreeProps) {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [internalSelectedFile, setInternalSelectedFile] = useState<
    string | null
  >(selectedFile ?? null);

  // ファイルツリーを取得（現在はモックデータ）
  useEffect(() => {
    // TODO: 将来的にnoteIdを使ってAPIからファイルリストを取得
    const mockTree = getMockFileTree();
    setFileTree(mockTree);

    // デフォルトでルートディレクトリを展開
    const rootDirs = mockTree
      .filter((node) => node.type === 'directory')
      .map((node) => node.path);
    setExpandedDirs(new Set(rootDirs));
  }, [noteId]);

  // 外部から selectedFile が変更された場合、内部状態を同期
  useEffect(() => {
    setInternalSelectedFile(selectedFile ?? null);
  }, [selectedFile]);

  /**
   * ディレクトリの展開/折りたたみを切り替える
   */
  const toggleDirectory = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  /**
   * ファイルを選択する
   */
  const handleFileClick = (path: string) => {
    const newSelectedFile = internalSelectedFile === path ? null : path;
    setInternalSelectedFile(newSelectedFile);
    onFileSelect?.(newSelectedFile);
  };

  /**
   * ディレクトリをクリック（展開/折りたたみ）
   */
  const handleDirectoryClick = (path: string) => {
    toggleDirectory(path);
  };

  /**
   * ファイルツリーノードを再帰的にレンダリング
   */
  const renderNode = (node: FileNode, depth: number = 0) => {
    const isDirectory = node.type === 'directory';
    const isExpanded = expandedDirs.has(node.path);
    const isSelected = internalSelectedFile === node.path;

    return (
      <div key={node.path} className="file-tree__node">
        <div
          className={`file-tree__item ${isSelected ? 'file-tree__item--selected' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() =>
            isDirectory
              ? handleDirectoryClick(node.path)
              : handleFileClick(node.path)
          }
        >
          {isDirectory ? (
            <>
              <span className="file-tree__icon">
                {isExpanded ? '📂' : '📁'}
              </span>
              <span className="file-tree__name">{node.name}</span>
            </>
          ) : (
            <>
              <span className="file-tree__icon">📄</span>
              <span className="file-tree__name">{node.name}</span>
            </>
          )}
        </div>

        {/* 子ノードを再帰的にレンダリング */}
        {isDirectory && isExpanded && node.children && (
          <div className="file-tree__children">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="file-tree">
      <div className="file-tree__header">
        <h2 className="file-tree__title">ソース: ファイルツリー</h2>
        {internalSelectedFile && (
          <button
            className="file-tree__clear-button"
            onClick={() => {
              setInternalSelectedFile(null);
              onFileSelect?.(null);
            }}
          >
            選択解除
          </button>
        )}
      </div>
      <div className="file-tree__content">
        {fileTree.length > 0 ? (
          fileTree.map((node) => renderNode(node))
        ) : (
          <p className="file-tree__empty">ファイルがありません</p>
        )}
      </div>
    </div>
  );
}

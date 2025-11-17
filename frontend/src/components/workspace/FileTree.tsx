import { useState, useEffect } from 'react';
import type { FileNode } from '@shared/types';
import { buildFileTree } from '@/lib/utils/fileTree';
import { notesApi } from '@/lib/api';
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ファイルツリーを取得
  useEffect(() => {
    if (!noteId) {
      setFileTree([]);
      return;
    }

    let isMounted = true;

    const fetchFileTree = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const filePaths = await notesApi.getFileTree(noteId);

        if (isMounted) {
          const tree = buildFileTree(filePaths);
          setFileTree(tree);

          // デフォルトでルートディレクトリを展開
          const rootDirs = tree
            .filter((node) => node.type === 'directory')
            .map((node) => node.path);
          setExpandedDirs(new Set(rootDirs));
        }
      } catch (error) {
        console.error('Failed to fetch file tree:', error);
        if (isMounted) {
          setFileTree([]);
          setError(
            error instanceof Error ? error.message : 'ファイルツリーの取得に失敗しました'
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchFileTree();

    return () => {
      isMounted = false;
    };
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
        {isLoading ? (
          <p className="file-tree__loading">読み込み中...</p>
        ) : error ? (
          <p className="file-tree__error">{error}</p>
        ) : fileTree.length > 0 ? (
          fileTree.map((node) => renderNode(node))
        ) : (
          <p className="file-tree__empty">ファイルがありません</p>
        )}
      </div>
    </div>
  );
}

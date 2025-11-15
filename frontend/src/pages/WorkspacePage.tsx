import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { WorkspaceLayout } from '../components/workspace/WorkspaceLayout';
import { FileTree } from '../components/workspace/FileTree';
import { ChatPanel } from '../components/workspace/ChatPanel';
import { MemoPanel } from '../components/workspace/MemoPanel';

/**
 * ワークスペースページ (/workspace/:id)
 * リポジトリごとの3カラム統合UIを表示する
 */
export function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  /**
   * ファイル選択時のハンドラー
   * FileTreeから選択されたファイルパスを受け取り、ChatPanelに伝播する
   */
  const handleFileSelect = (filePath: string | null) => {
    setSelectedFile(filePath);
    console.log('選択されたファイル:', filePath ?? 'なし（リポジトリ全体）');
  };

  return (
    <WorkspaceLayout
      leftPanel={
        <FileTree
          noteId={id}
          selectedFile={selectedFile}
          onFileSelect={handleFileSelect}
        />
      }
      centerPanel={
        <ChatPanel
          noteId={id}
          selectedFiles={selectedFile ? [selectedFile] : undefined}
        />
      }
      rightPanel={<MemoPanel />}
    />
  );
}

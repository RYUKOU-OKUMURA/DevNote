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

  return (
    <WorkspaceLayout
      leftPanel={<FileTree />}
      centerPanel={<ChatPanel />}
      rightPanel={<MemoPanel />}
    />
  );
}

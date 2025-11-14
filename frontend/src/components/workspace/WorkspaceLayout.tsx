import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import './WorkspaceLayout.css';

interface WorkspaceLayoutProps {
  leftPanel: ReactNode;
  centerPanel: ReactNode;
  rightPanel: ReactNode;
}

type PanelType = 'files' | 'chat' | 'memo';

/**
 * 3カラムレイアウトコンポーネント
 * デスクトップ: 左20% / 中央50% / 右30%
 * タブレット: 中央カラムをデフォルト表示、左右はタブ切り替え
 * モバイル: 下部タブまたはスワイプで3領域を切り替え
 */
export function WorkspaceLayout({
  leftPanel,
  centerPanel,
  rightPanel,
}: WorkspaceLayoutProps) {
  const [activePanel, setActivePanel] = useState<PanelType>('chat');
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  // スワイプジェスチャーの検出
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchMove = (e: TouchEvent) => {
      touchEndX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = () => {
      const swipeThreshold = 50; // 最小スワイプ距離（ピクセル）
      const diff = touchStartX.current - touchEndX.current;

      // 右スワイプ（前のパネルへ）
      if (diff < -swipeThreshold) {
        if (activePanel === 'memo') setActivePanel('chat');
        else if (activePanel === 'chat') setActivePanel('files');
      }

      // 左スワイプ（次のパネルへ）
      if (diff > swipeThreshold) {
        if (activePanel === 'files') setActivePanel('chat');
        else if (activePanel === 'chat') setActivePanel('memo');
      }

      touchStartX.current = 0;
      touchEndX.current = 0;
    };

    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchmove', handleTouchMove);
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [activePanel]);

  return (
    <div className="workspace-layout" ref={containerRef}>
      {/* タブレット用のタブナビゲーション */}
      <nav className="workspace-layout__tablet-tabs">
        <button
          className={`workspace-layout__tablet-tab ${activePanel === 'files' ? 'active' : ''}`}
          onClick={() => setActivePanel('files')}
        >
          ファイルツリー
        </button>
        <button
          className={`workspace-layout__tablet-tab ${activePanel === 'chat' ? 'active' : ''}`}
          onClick={() => setActivePanel('chat')}
        >
          チャット
        </button>
        <button
          className={`workspace-layout__tablet-tab ${activePanel === 'memo' ? 'active' : ''}`}
          onClick={() => setActivePanel('memo')}
        >
          メモパッド
        </button>
      </nav>

      {/* デスクトップ用の3カラムレイアウト & タブレット/モバイル用のタブコンテンツ */}
      <aside
        className={`workspace-layout__left ${activePanel === 'files' ? 'tablet-active mobile-active' : ''}`}
      >
        {leftPanel}
      </aside>
      <main
        className={`workspace-layout__center ${activePanel === 'chat' ? 'tablet-active mobile-active' : ''}`}
      >
        {centerPanel}
      </main>
      <aside
        className={`workspace-layout__right ${activePanel === 'memo' ? 'tablet-active mobile-active' : ''}`}
      >
        {rightPanel}
      </aside>

      {/* モバイル用の下部タブナビゲーション */}
      <nav className="workspace-layout__mobile-tabs">
        <button
          className={`workspace-layout__mobile-tab ${activePanel === 'files' ? 'active' : ''}`}
          onClick={() => setActivePanel('files')}
        >
          <span className="workspace-layout__mobile-tab-icon">📁</span>
          <span className="workspace-layout__mobile-tab-label">ファイル</span>
        </button>
        <button
          className={`workspace-layout__mobile-tab ${activePanel === 'chat' ? 'active' : ''}`}
          onClick={() => setActivePanel('chat')}
        >
          <span className="workspace-layout__mobile-tab-icon">💬</span>
          <span className="workspace-layout__mobile-tab-label">チャット</span>
        </button>
        <button
          className={`workspace-layout__mobile-tab ${activePanel === 'memo' ? 'active' : ''}`}
          onClick={() => setActivePanel('memo')}
        >
          <span className="workspace-layout__mobile-tab-icon">📝</span>
          <span className="workspace-layout__mobile-tab-label">メモ</span>
        </button>
      </nav>
    </div>
  );
}

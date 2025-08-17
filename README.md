# ShisanKanri: 資産管理ポートフォリオ管理システム

## 概要
本システムは、株式および投資戦略の管理に特化した資産管理ポートフォリオ管理システムです。ユーザーは保有銘柄の追加・更新・削除、投資戦略の管理、資産配分の確認などを行うことができます。

## 技術スタック
- **フロントエンド**: React, TypeScript, Vite
- **バックエンド**: FastAPI (Python), SQLAlchemy
- **データベース**: SQLite (`portfolio.db`)
- **テスト**: Playwright (E2E), Pytest (バックエンド単体・統合テスト - 予定)

## 環境構築

### 前提条件
- Python 3.9+
- Node.js (npm)

### 手順

1.  **リポジトリのクローン**
    ```bash
    git clone [リポジトリのURL]
    cd ShisanKanri
    ```

2.  **バックエンドのセットアップ**
    ```bash
    cd backend
    python -m venv venv
    ./venv/Scripts/activate  # Windows
    # source venv/bin/activate # macOS/Linux
    pip install -r requirements.txt
    cd ..
    ```

3.  **フロントエンドのセットアップ**
    ```bash
    cd frontend
    npm install
    cd ..
    ```

## アプリケーションの実行

プロジェクトのルートに `start_servers.bat` があり、バックエンド (FastAPI) とフロントエンド (React) の開発サーバーを同時に起動できます。

1.  **プロジェクトルートに移動**
    ```bash
    cd C:\Users\y-murase\Documents\Dev\ShisanKanri
    ```

2.  **サーバーの起動**
    ```bash
    start_servers.bat
    ```
    *   バックエンドとフロントエンド用に2つのコマンドプロンプトウィンドウが開きます。
    *   フロントエンドは `http://localhost:5173` でアクセス可能です。

3.  **サーバーの停止**
    開いたコマンドプロンプトウィンドウを閉じるか、`stop_servers.bat` があればそれを使用します。

## テストの実行

### フロントエンド (E2Eテスト)
Playwright を使用したE2Eテストが `frontend/e2e/` ディレクトリにあります。

1.  **フロントエンドディレクトリに移動**
    ```bash
    cd frontend
    ```

2.  **テストの実行**
    ```bash
    npx playwright test
    ```

### バックエンド (単体・統合テスト)
現在、プロジェクト固有のバックエンドテストは実装されていません。Pytest を使用して今後実装予定です。

## データベース
- SQLiteデータベースファイル `portfolio.db` はプロジェクトルートに配置されます。
- データベースマイグレーションは SQLAlchemy によって自動的に処理されます。

## 主要機能
- 銘柄管理: 新規銘柄の追加、既存銘柄の更新・削除、保有銘柄とその詳細・リアルタイム価格の一覧表示。
- 戦略管理: 新規投資戦略の追加、既存戦略の更新・削除、階層関係を含む全戦略の一覧表示。
- 銘柄への戦略紐付け: 銘柄に複数の戦略を関連付け可能。
- 資産配分: カテゴリごとの現在の資産構成表示、目標資産配分比率の設定。
# 資産管理ポートフォリオ管理システム: 設計ドキュメント

## 1. 概要

本ドキュメントは、資産管理ポートフォリオ管理システムの要件、仕様、設計を概説します。特に、株式および戦略管理機能における最近の強化に焦点を当てています。

## 2. システムアーキテクチャ

本システムはクライアント・サーバーアーキテクチャを採用しています。

*   **フロントエンド**: React, TypeScript, Vite を使用したユーザーインターフェース。
*   **バックエンド**: FastAPI (Python) によるAPIリクエスト処理、ビジネスロジック、データベース操作。
*   **データベース**: SQLite (SQLAlchemy ORM管理) を使用したポートフォリオデータの永続化。
*   **テスト環境**: バックエンドテストには、インメモリSQLiteデータベースを使用し、テストの分離と高速化を図ります。

## 3. 主要機能

本システムは以下の機能を提供します。

*   **銘柄管理**:
    *   新規銘柄の追加、既存銘柄の更新（数量、取得価格、カテゴリ、関連戦略）、削除。
    *   保有銘柄とその詳細、リアルタイム価格の一覧表示。
*   **戦略管理**:
    *   新規投資戦略の追加、既存戦略の更新、削除。
    *   階層関係を含む全戦略の一覧表示。
    *   **階層戦略**: 親子関係を持つ戦略をサポート。
    *   **子戦略の1世代制限**: 子戦略はトップレベルの戦略のみを親とできます。
*   **銘柄への戦略紐付け**:
    *   銘柄に複数の戦略を関連付け可能。
    *   **階層選択**: 親戦略と子戦略を個別に選択。
    *   **直接の子孫制約**: 子戦略選択時、その直接の親戦略も同じ銘柄に選択されている必要があります。
*   **資産配分**:
    *   カテゴリごとの現在の資産構成表示。
    *   目標資産配分比率の設定。

## 4. 設計詳細: バックエンド

### 4.1. モデル (`backend/models.py`)

*   **`Stock`**: 保有銘柄。`id`, `ticker`, `name`, `quantity`, `acquisition_price`, `category` 属性を持ち、`stock_strategy_association` テーブルを介して `Strategy` と多対多で関連付けられます。
*   **`Strategy`**: 投資戦略。`id`, `name`, `description` 属性を持ち、`parent_id` による自己参照関係で親子階層を形成します。`stock_strategy_association` テーブルを介して `Stock` と多対多で関連付けられます。
*   **`TargetAllocation`**: カテゴリごとの目標配分比率。

### 4.2. スキーマ (`backend/schemas.py`)

データ検証とシリアライズのための Pydantic モデル。

*   **`StockBase`**: 銘柄データの基本スキーマ。`strategy_ids: Optional[List[int]]` を含みます。
*   **`StockCreate`**: `StockBase` を継承。
*   **`StockUpdate`**: `StockBase` を継承。
*   **`Stock`**: 銘柄データのレスポンスモデル。`strategies: List[Strategy]` (Eager Loading) を含みます。
*   **`StrategyBase`**: 戦略データの基本スキーマ。`parent_id: Optional[int]` を含みます。
*   **`StrategyCreate`**: `StrategyBase` を継承。
*   **`Strategy`**: 戦略データのレスポンスモデル。`id` を含みます。
*   **`QuoteData`**: Finnhubから取得する株価データのためのスキーマ。

**Pydantic v2対応**: `Config` クラスは `model_config = ConfigDict(from_attributes=True)` に更新されました。

### 4.3. CRUD 操作 (`backend/crud.py`)

*   **`get_strategies(db, skip, limit, parent_id)`**:
    *   `parent_id` が `None` の場合、トップレベルだけでなく *すべての* 戦略を返します。これにより、フロントエンドで完全な階層を構築できます。
*   **`create_strategy(db, strategy)`**:
    *   「子戦略の1世代制限」を検証します。`parent_id` が指定されている場合、親戦略自体が `parent_id` を持たないことを確認します。違反時は `HTTPException` (400 Bad Request) を発生させます。
*   **`create_stock(db, stock_data)`**:
    *   `stock_data` から `strategy_ids` を抽出し、`Stock` オブジェクトと関連付けます。
*   **`update_stock(db, stock_id, stock)`**:
    *   既存の `Stock` オブジェクトの `strategy_ids` 関連付けを更新します（既存をクリアし、新しいものを追加）。
    *   Pydanticモデルのデータ抽出に `.dict()` の代わりに `.model_dump()` を使用するように更新されました。
*   **`get_stock(db, stock_id)` / `get_stocks(db, skip, limit)`**:
    *   `joinedload` を使用して `strategies` 関係を Eager Loading し、関連戦略が銘柄データと共に取得されるようにすることで、フロントエンドでの N+1 クエリの問題を軽減します。

### 4.4. API エンドポイント (`backend/main.py`)

*   **CORS設定**: フロントエンドからのアクセスを許可するため、`http://127.0.0.1:5173` が `allow_origins` に追加されました。
*   **テスト用依存性注入**: テスト時にインメモリデータベースを使用するため、`get_db` 依存性をオーバーライドする `override_get_db` 関数が追加されました。
*   **`validate_strategy_hierarchy(db, strategy_ids)` (ヘルパー関数)**:
    *   銘柄に戦略を紐付ける際の「直接の子孫制約」に対するサーバーサイド検証を実行します。選択された子戦略の親が `strategy_ids` リストにも存在することを確認します。違反時は `HTTPException` (400 Bad Request) を発生させます。
*   **`POST /stocks/` (銘柄作成)**:
    *   銘柄作成前に `validate_strategy_hierarchy` を呼び出し、直接の子孫制約を強制します。
    *   Pydanticモデルのデータ抽出に `.dict()` の代わりに `.model_dump()` を使用するように更新されました。
*   **`GET /stocks/{stock_id}`**: 単一の銘柄をIDで取得するエンドポイントが追加されました。
*   **`PUT /stocks/{stock_id}` (銘柄更新)**:
    *   銘柄更新前に `validate_strategy_hierarchy` を呼び出し、直接の子孫制約を強制します。
*   **`GET /stocks/live-prices`**: 全銘柄のリアルタイム価格を取得するエンドポイントが、`market_data.get_quote_data` を使用し、`schemas.QuoteData` を返すように更新されました。
*   **Finnhub関連エンドポイント**: 銘柄詳細ページで利用される以下のエンドポイントが復元されました。
    *   `GET /stocks/live-prices/{ticker}`
    *   `GET /stocks/{ticker}/profile`
    *   `GET /stocks/{ticker}/metrics`
    *   `GET /stocks/{ticker}/news`
*   **`GET /strategies/`**: `crud.get_strategies` の動作に基づいて戦略を返します。

## 5. 設計詳細 (フロントエンド)

### 5.1. `frontend/src/components/StockFormPage.tsx` (銘柄追加ページ)

*   **変更**: すべての戦略選択フィールドと関連ロジックを削除しました。このページは、基本的な銘柄情報の追加のみを目的としています。

### 5.2. `frontend/src/components/StockListPage.tsx` (保有銘柄一覧ページ)

*   **編集モードでの戦略選択**:
    *   **実装**: 銘柄を編集する際、戦略選択は2つの独立した複数選択ドロップダウンを使用するようになりました。「親戦略」用と「子戦略」用です。
    *   **動的な子オプション**: 「子戦略」ドロップダウンで利用可能なオプションは、「親戦略」ドロップダウンで選択された戦略の直接の子のみを表示するように動的にフィルタリングされます。
    *   **フロントエンド検証**: 子戦略が選択されている場合、その親戦略も「親戦略」ドロップダウンで選択されていることを確認するクライアントサイド検証を実装します。このルールに違反した場合、アラートが表示されます。
    *   **表示**: 関連付けられた戦略は、銘柄一覧テーブルに表示されます（例: `stock.strategies.map(s => s.name).join(', ')`）。
    *   **ユーザーガイダンス**: 子戦略の選択方法をユーザーに案内するメッセージを追加しました（例: 「親戦略を選択すると、関連する子戦略が表示されます。」）。
*   **銘柄コードのリンク化**: 保有銘柄一覧の銘柄コードが、個別銘柄詳細ページへのリンクとして機能するようになりました。
*   **テーブルのHTML構造の修正**: `<thead>` および `<tbody>` 内の不要な空白テキストノードが削除され、HTML構造が修正されました。

### 5.3. `frontend/src/components/StockDetailPage.tsx` (個別銘柄詳細ページ)

*   **機能**: 各保有銘柄の個別ページとして実装され、以下の機能を提供します。
    *   **株式指標の表示**: 株価、前日比、PER、PBR、配当利回り、時価総額、出来高、52週高値/安値。
        *   PERは`peTTM`、PBRは`pb`、配当利回りは`currentDividendYieldTTM`、52週高値/安値は`metrics`データから取得するように修正されました。
    *   **指標説明ダイアログ**: 各指標をクリックすると、その説明をダイアログで表示します。
    *   **関連ニュース一覧**: 直近の関連ニュースへのリンク一覧を表示します。
*   **データ取得**: バックエンドAPI (`/stocks/{ticker}/profile`, `/stocks/{ticker}/metrics`, `/stocks/{ticker}/news`) からデータを非同期で取得し表示します。
*   **HTML構造の修正**: `<tbody>` の重複など、HTML構造に関する問題が修正されました。

### 5.4. `frontend/src/components/StrategyPage.tsx` (戦略管理ページ)

*   **エラー処理の改善**: 戦略作成時にバックエンドからの詳細なエラーメッセージ（例: 「Strategy with this name already registered」）を表示するように変更され、ユーザーにより明確なフィードバックを提供します。

### 5.5. `frontend/src/App.tsx`

*   **`Stock` インターフェースの更新**: `Stock` インターフェースに `strategies: Strategy[]` が含まれるようになり、バックエンドから受け取った Eager Loading された戦略データを正しく型付けし、子コンポーネントに渡せるようになりました。
*   **`Strategy` インターフェースの定義**: フロントエンド全体での一貫性のために、`Strategy` インターフェースの定義を追加しました。
*   **ルーティングの追加**: `/stocks/:stockId` パスに `StockDetailPage` コンポーネントをルーティングする設定が追加されました。

## サーバーの起動

プロジェクトのルートに `start_servers.bat` があり、バックエンド (FastAPI) とフロントエンド (React) の開発サーバーを同時に起動できます。

**使用方法:**
1.  依存関係がインストールされていることを確認してください。
2.  プロジェクトルート (`C:\Users\y-murase\Documents\Dev\ShisanKanri`) から `start_servers.bat` を実行します。
    ```bash
    start_servers.bat
    ```
3.  バックエンドとフロントエンド用に2つのコマンドプロンプトウィンドウが開きます。
    *   **Uvicornの監視**: `--reload-dir backend` オプションにより、バックエンドディレクトリのみを監視し、不要なリロードやエラーを防ぎます。
4.  サーバーを停止するには、これらのウィンドウを閉じるか、`stop_servers.bat` を使用します。

## データベース

*   SQLiteデータベースファイル `portfolio.db` はプロジェクトルートに配置されます。
*   データベースマイグレーションは SQLAlchemy によって自動的に処理されます。

## API エンドポイント (主要な例)

*   `/stocks/`: GET (全銘柄一覧), POST (新規銘柄追加)
*   `/stocks/{stock_id}`: GET (単一銘柄取得), PUT (銘柄更新), DELETE (銘柄削除)
*   `/market_data/refresh`: POST (市場データ更新)

## 6. 今後の検討事項

*   **エラー処理の改善**: アプリケーション全体で、より一元化されたユーザーフレンドリーなエラー表示メカニズムを実装できます。
*   **UI/UX の改善**: 戦略の複数選択ドロップダウンは、多数の戦略がある場合の使いやすさを向上させるために、検索機能やより高度な UI コンポーネントで強化できます。
*   **テスト**: フロントエンドとバックエンドの機能に対する包括的な単体テストと統合テストは、堅牢性と回帰防止に不可欠です。バックエンドのテストは現在包括的であり、Stock、Strategy、AllocationのCRUD操作および主要なバリデーションロジックをカバーしています。フロントエンドのE2Eテストの導入が次のステップとして推奨されます。
*   **通貨表記**: アプリケーションのUIにおけるすべての金額表示（例: 合計評価損益、取得価格、配当利回りなど）は、ドル ($) 表記とする。
*   **LLM組み込み**: 各保有銘柄の個別ページにLLMを組み込み、対象銘柄についてユーザーが相談できるようにする。
*   **LLM組み込み (投資戦略)**: 投資戦略についてユーザーがLLMに相談できるようにする。

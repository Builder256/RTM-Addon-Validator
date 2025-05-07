
# RTM Addon Validator

## 概要
RTM Addon Validatorは、RealTrainMod (RTM) 用のアドオンファイルを検証するツールです。このツールは、アドオンのZIPファイルを解析し、必要なJSONファイルやリソースファイルが正しく設定されているかを確認します。

## 特徴
- `ModelTrain_*.json` ファイルの解析と検証
- モデルファイル、テクスチャファイル、スクリプトファイルの存在確認
- 座席設定やボタンテクスチャ設定などの検証
- エラー内容を詳細に出力

## 必要条件
- Node.js (20.17.0 またはそれ以降)
- 以下のnpmパッケージ:
  - `unzipper`
  - `iconv-lite`

## インストール
1. このリポジトリをクローンします:
   ```bash
   git clone https://github.com/Builder256/RTM-Addon-Validator
   cd RTM-Addon-Validator
   ```
2. 必要な依存関係をインストールします:
   ```bash
   npm install
   ```

## 使用方法
1. 検証したいRTMアドオンのZIPファイルを `addon/` ディレクトリに配置します。
2. `index.js` 内の `TARGET_FILE` に検証対象のZIPファイル名を設定します。
   ```javascript
   const TARGET_FILE = 'your_addon.zip';
   ```
3. 以下のコマンドを実行して検証を開始します:
   ```bash
   npm run test
   ```
4. 結果がコンソールに出力されます。エラーがある場合は詳細が表示されます。

## 出力例
### 正常な場合
```
全てのJSONファイルの解析が完了しました。問題はありません。
```

### エラーがある場合
```
エラーが発生しました。詳細は下記を確認してください。
JSON:addon/your_addon/mods/RTM/train/ModelTrain_your_train_1.jsonで、"buttonTexture"が適切に設定されていません。
JSON:addon/your_addon/mods/RTM/train/ModelTrain_your_train_2.jsonで、座席設定が正しく設定されていません。"seatPos"のみ、または"slotPos"と"seatPosF"の両方を設定してください。
```

## ファイル構成
- `index.js`: メインスクリプト。ZIPファイルを解析し、JSONファイルやリソースファイルを検証します。
- `addon/`: 検証対象のZIPファイルを配置するディレクトリ。
- `package.json`: プロジェクトの依存関係とスクリプトを定義。

## 主な機能
### JSONファイルの検証
- `ModelTrain_*.json` ファイルが存在するか確認します。
- 以下の項目を検証します:
  - `trainModel2` の設定
  - `bogieModel2` または `bogieModel3` の設定
  - `buttonTexture` の設定
  - `rollsignTexture` の設定
  - 座席設定 (`seatPos` または `slotPos` と `seatPosF`)

### リソースファイルの検証
- モデルファイル (`.mqo`)
- テクスチャファイル (`.png`)
- スクリプトファイル (`.js`)

## 注意事項
- このツールはRTMアドオンの検証を目的としており、アドオンの内容を修正する機能はありません。
- 検証対象のZIPファイルは、正しいディレクトリ構造である必要があります。

## ライセンス
このプロジェクトは [MIT LICENSE](LICENSE) の下で公開されています。

## 貢献
バグ報告や機能提案は、Issueを通じて受け付けています。プルリクエストも歓迎します。

## 展望
このプロジェクトでは、以下の機能や改善を将来的に実装することを目指します:

1. **GUIの提供**  
   WEBアプリケーションまたはネイティブアプリとしてグラフィカルインターフェースを追加する。

2. **詳細なレポート生成**  
   検証結果をHTMLやPDF形式で出力し、共有や記録が簡単にできるようにする。
# チェック用の限定公開

## GitHub Pages（いまの公開先。付録B-38）

- リポジトリ：`srhr-u35-simulator`（公開）。main に送ると、GitHub Actions が自動でテスト・ビルドして公開し直す（.github/workflows/pages.yml）。
- 公開先：`https://（アカウント名）.github.io/srhr-u35-simulator/`
- GitHub Pages では `.htaccess` が効かないため、セキュリティの設定（CSP）と検索エンジン除けは、ページの中に書いている（`PAGES=1 npm run build:check`）。
- 公開の状態は、リポジトリの「Actions」タブで見られる。

## さくらインターネットにアップロードする場合

チェックのための限定公開の手順。本公開の手順は SPEC.md §13 を見る。
パスワードはかけない。検索エンジンに載らない設定だけを付ける（付録B-37）。URL を知っている人だけが見る想定。

## 1. ファイルを作る

```bash
npm run build:check
```

- `dist/` と、その中身をまとめた `srhr-check.zip` ができる。
- 検索エンジンに載らない設定（`<meta name="robots">`、`robots.txt`、`X-Robots-Tag`）が付く。
- 本公開のときは `npm run build` だけを使う（この設定は付かない）。

## 2. アップロード（修正のたびに上書き）

公開フォルダの中に、推測されにくい名前のフォルダ（例：`check-u35/`）を作り、`dist/` の **中身**（`index.html`、`assets/`、`.htaccess`、`robots.txt`）を上書きでアップロードする。

- `.htaccess` は名前が「.」で始まるため、FTP ソフトによっては見えない。「隠しファイルを表示」にする。
- 古い `assets/` のファイルは残っていても動く（ファイル名が毎回変わるため）。気になるときは消してからアップロードする。
- `robots.txt` は、本来はドメインのいちばん上に置いたものだけが読まれる。フォルダの中の `robots.txt` は効かないが、`<meta name="robots">` と `X-Robots-Tag` で検索エンジンには載らない。

## 3. 確かめる

```bash
curl -sI https://（ドメイン）/check-u35/ | grep -iE "x-robots|content-security|nosniff"
```

`X-Robots-Tag: noindex, nofollow` が出ればよい。

## 注意

- URL を知っている人は見られる。チェックの人に伝えるときは、SNS など公開の場所に URL を書かない。
- チェックの人の進行状況は、その人のブラウザの中だけに保存される（サーバーには送られない）。

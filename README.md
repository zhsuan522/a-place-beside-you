# 《換個地方陪著你》

[▶ 開始遊玩](https://zhsuan522.github.io/a-place-beside-you/) · [GitHub repository](https://github.com/zhsuan522/a-place-beside-you)

根目錄的 `index.html` 直接進入「星空小樹屋」。目前已有可玩的本機原型：建立星球、挑選森林或海邊、選擇補給與 6／12／24 小時旅程、閱讀明信片，並將回憶收進相簿。

## 啟動

```sh
npm install
npm run dev
```

Vite 啟動後，開啟終端顯示的本機網址。開發預覽中可在旅程倒數頁按「原型快速預覽」立即查看明信片，不必等待真實時間。

## 原型資料範圍

- 旅程倒數會跨瀏覽器重新整理保留，並使用本機時間計算抵達狀態。
- 毛孩照片、私人文字、星球、旅程及明信片存在目前瀏覽器的 `localStorage`，不會同步到其他裝置。
- 相簿提供 JSON 備份和刪除本機資料的操作。
- 帳號登入、雲端保存、跨裝置同步與伺服器端計時尚未接入；目前是本機可玩原型，不是已上線的完整服務。

## 專案結構

- `src/main.js`：建立 Phaser 遊戲並啟動遊戲介面。
- `src/game/ui.js`：旅程流程、星圖、信箱、相簿和本機原型存檔。
- `src/game/config/`：遊戲視窗和 Phaser 設定。
- `src/game/scenes/`：遊戲場景，例如主遊戲、關卡或結算場景。
- `src/game/entities/`：玩家、敵人、道具等遊戲物件。
- `src/game/systems/`：規則、關卡流程、存檔等系統。
- `src/game/ui/`：遊戲內 HUD、對話框和選單。
- `src/styles/`：遊戲頁面的 CSS。
- `public/assets/`：圖片、音訊、字型、地圖和資料檔。Kenney 原始素材包及授權檔保存在 `public/assets/packs/kenney/`，精選路徑索引在 `public/assets/data/kenney-assets.json`。Vite 以 `import.meta.env.BASE_URL` 解析資產路徑，支援本機與 GitHub Pages 子路徑。

`public/assets/` 目前按背景、角色、環境、介面、Sprite Sheet、Tilemap、音樂、音效、字型和資料分類。遊戲確定後，可再依實際玩法調整分類。

# MVP 素材挑選清冊

**狀態：** 第一階段已完成  
**日期：** 2026-10-27  
**方向：** 扁平、圓潤的 2D 插畫；Kenney 素材供 MVP 使用，後續可換成手繪插畫。

## 已選 Kenney 素材包

所有素材包都從 Kenney 官方頁面下載。官方頁面與包內 `License.txt` 均確認為 Creative Commons CC0 1.0；原始 ZIP、授權檔、預覽圖與逐檔資訊已保存在專案中。

| 素材包 | MVP 用途 | 初選檔案／內容 | 官方來源 |
|---|---|---|---|
| Background Elements Remastered | 星空小樹屋、森林和海岸場景的組合素材 | `Backgrounds/backgroundForest.png`、`backgroundEmpty.png`、`PNG/Default/tree.png`、`treePine.png`、`treePalm.png`、`houseSmall1.png`、`cloud1.png` | [Kenney 官方頁](https://kenney.nl/assets/background-elements-remastered) |
| Planets | 星圖上的星球圖示 | `Planets/planet00.png` 至 `planet09.png`；`Parts/` 可供後續變化 | [Kenney 官方頁](https://kenney.nl/assets/planets) |
| UI Pack - Adventure | 明信片紙面、卡片面板和少數按鈕 | `PNG/Double/panel_grid_paper.png`、`panel_brown.png`、`button_brown.png`、`banner_hanging.png`、`minimap_icon_star_yellow.png` | [Kenney 官方頁](https://kenney.nl/assets/ui-pack-adventure) |
| Generic Items | 補給與紀念品的通用物件圖示素材池 | `Spritesheet/genericItems_spritesheet_colored.png` 及對應 `.xml`；實作時只挑適合且不限定毛孩物種的圖示 | [Kenney 官方頁](https://kenney.nl/assets/generic-items) |

## MVP 場景與素材組合

- **森林星球：** 使用森林背景及樹木素材，保留一點夜色和星光。
- **海岸星球：** 使用空白天空、棕櫚樹素材；海面與沙岸用 Phaser 簡單圖形補足。第一版不加金字塔或其他會讓場景變成沙漠的元素。
- **星空小樹屋：** Kenney 沒有直接對應的 2D 樹屋圖；用大樹與小屋素材組合，平台、窗光和星星以 Phaser 圖形補足。
- **星圖：** 使用 Planets 的星球貼圖；星球旁的路線和星光由 Phaser 繪製。
- **明信片：** 用米色紙面面板承載文字，避免把 UI 包裡較強烈的警告框、紅色進度條當作主要介面。
- **補給：** MVP 暫定三類為「玩具、點心、熟悉的小物」。圖示從 Generic Items 中挑選中性物件；若沒有合適圖示，以簡單圖形補足，不以狗骨頭當所有毛孩的預設補給。
- **毛孩呈現：** 使用者上傳的照片仍只放在毛孩資料與相簿。MVP 不用單一物種的 Kenney 動物圖代表所有玩家；沒有照片時用 Phaser 繪製通用爪印標記。

## 曾評估但不納入

**Animal Pack Remastered** 已檢查預覽和檔案清單。雖有多種動物圖示，但沒有貓圖；為避免用單一物種代表所有玩家，未放入 MVP 素材。若日後有完整物種需求，再重新評估或使用客製插畫。

## 專案內檔案位置

- 原始 ZIP 與完整解壓內容：`public/assets/packs/kenney/<pack-slug>/`
- 每包的授權檔、來源、ZIP SHA-256、檔案類型與可讀圖片尺寸：同資料夾中的 `pack-manifest.json`
- Phaser 可用的精選路徑索引：`public/assets/data/kenney-assets.json`
- 原始素材包結構與檔名均保留；目前不把素材複製散落到其他圖片分類資料夾。

## 進入 MVP 前的實作約定

1. 先用本清冊的素材搭出森林、海岸、樹屋、星圖和明信片的手機版構圖。
2. 需要登入、長文字或照片選取時使用 HTML 表單；Phaser 負責遊戲場景和互動視覺。
3. MVP 只把已挑選的少量素材接入畫面，不載入整包素材。
4. 手繪替換時保留目前的素材索引與用途標記，逐項替換，不更動旅程規則。

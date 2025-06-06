# 麻醉科護理班表管理系統使用指南 (v0.9.3)

本文檔詳細說明麻醉科護理班表管理系統的各項功能和使用方法。

## 系統概覽

麻醉科護理班表管理系統是專為麻醉科部門設計的班表管理工具，支援護理長排班和護理師查詢班表的完整流程。系統v0.9.3版本新增醫師班表功能並完成UI扁平化設計，提供更現代化的使用體驗。

## 登入方式

### 1. 傳統密碼登入
- 輸入用戶名和密碼
- 點擊「登入」按鈕

### 2. Passkey無密碼登入 (WebAuthn)
- 點擊「使用Passkey登入」按鈕
- 使用生物辨識（指紋、Face ID）或PIN碼驗證
- 支援跨裝置使用

## 系統角色與權限

### 護理長 (admin)
- 完整系統管理權限
- 排班管理與班表發布
- 用戶管理
- 公告發布
- 換班審核

### 一般護理師 (nurse)
- 查詢個人班表
- 查看月班表
- 申請換班
- 查看公告

## 主要功能詳解

### 1. 儀表板 (Dashboard)

儀表板提供系統概覽：
- **今日班表**：顯示當天的班表資訊
- **最新公告**：顯示最近發布的公告
- **換班請求**：顯示待處理的換班申請
- **系統統計**：用戶數量、班表數量等統計資訊

### 2. 用戶管理 (僅護理長)

#### 護理師身份分類
系統支援四種護理師身份：
- **麻醉專科護理師**：班型為 D(日班)、A(小夜班)、N(大夜班)、O(休假)
- **恢復室護理師**：班型為 A(日班)、K(早班)、C(中班)、F(晚班)、O(休假)
- **麻醉科Leader**：班型為 A(日班)、E(半班)、O(休假)
- **麻醉科書記**：班型為 B(日班)、E(半班)、O(休假)

#### 用戶管理操作
- **新增用戶**：設定姓名、用戶名、密碼、身份、角色
- **編輯用戶**：修改用戶資訊
- **刪除用戶**：移除用戶帳號
- **調整順序**：設定護理師在班表中的顯示順序

### 3. 公式班表設定 (僅護理長)

公式班表是月班表生成的基礎模板：

#### 設定步驟
1. **選擇身份類別**：麻醉專科護理師、恢復室護理師等
2. **設定組別數量**：每種身份可設定多個組別
3. **配置班表模式**：設定各組別的排班循環模式
4. **儲存設定**：完成後儲存公式班表

#### 班表模式說明
- 每個組別可設定不同的排班循環
- 支援複雜的排班模式組合
- 可預覽班表效果

### 4. 月班表管理

#### 月班表生成 (護理長)
1. **選擇月份**：選擇要生成班表的月份
2. **套用公式班表**：系統自動根據公式班表生成初始班表
3. **手動調整**：可手動修改特定日期的班別
4. **工作分配**：為A班護理師分配工作區域
5. **發布班表**：確認無誤後發布班表

#### 工作分配功能
- **主要工作分配**：基本工作區域分配（OR、DR、3F等）
- **PM工作分配**：新增複選PM工作分配功能
- **快速分配**：提供一鍵分配功能
- **統計顯示**：顯示工作分配統計資訊

#### 夜班包班管理
- **小夜班包班(SNP)**：專門處理小夜班的包班護理師
- **大夜班包班(LNP)**：專門處理大夜班的包班護理師
- **分類顯示**：標籤頁分別顯示常規、SNP、LNP班表
- **一鍵更新**：護理長可快速更新包班人員列表

#### 月班表查詢 (所有用戶)
- **個人班表**：查看自己的月班表
- **全部班表**：查看所有人員的月班表
- **工作分配查詢**：查看A班工作分配情況
- **PDF匯出**：將班表匯出為PDF格式

### 5. 週班表查詢

週班表提供更詳細的週期性班表檢視：
- **個人週班表**：顯示個人的週班表資訊
- **工作分配顯示**：顯示A班的工作分配詳情
- **班別統計**：統計各班別的人數分布

### 6. 醫師班表系統 (v0.9.3 全面升級)

#### 功能特色
- **自動更新**：系統每5分鐘自動更新當月班表，每日凌晨更新未來四個月
- **完整資訊**：顯示當值醫師、手術室分配、各科別醫師
- **月份切換**：左右箭頭快速切換月份
- **響應式設計**：優化移動設備顯示
- **醫師狀態管理**：支援上下班、開會、請假狀態管理（v0.9.3新增）
- **開會時間管理**：設定和管理醫師開會時間（v0.9.3新增）
- **無障礙性支援**：完整的鍵盤導航和螢幕閱讀器支援（v0.9.3新增）
- **扁平化UI設計**：現代化的使用者介面設計（v0.9.3新增）

#### 基本使用方法
1. **進入醫師班表頁面**
2. **選擇月份**：使用左右箭頭或點擊月份選擇器
3. **查看當值醫師**：每日顯示當值醫師資訊
4. **手術室分配**：查看各手術室與刀房的醫師分配
5. **科別區分**：顯示不同科別醫師（麻醉科、外科、婦產科等）

#### 醫師狀態管理 (v0.9.3 新功能)

##### 狀態類型
醫師狀態分為三種：
- **已下班**：醫師已下班，顯示藍色「下班」按鈕
- **開會中**：醫師正在開會，顯示黃色「開會中」狀態
- **請假**：醫師請假，顯示紅色「請假」狀態

##### 狀態切換操作
1. **上下班切換**：
   - 點擊醫師姓名旁的動態更新按鈕
   - 選擇「下班」（藍色按鈕）進行下班操作
   - 系統會顯示確認對話框，確認後更新狀態

2. **請假設定**：
   - 點擊「請假」（紅色按鈕）
   - 確認後醫師狀態將顯示為「請假」
   - 請假狀態與已下班狀態在顯示上有明確區分

3. **狀態優先級**：
   - 開會中 > 請假 > 已下班
   - 系統會依據優先級顯示正確的狀態文字

#### 開會時間管理 (v0.9.3 新功能)

##### 設定開會時間
1. **開啟設定介面**：
   - 點擊醫師姓名旁的動態更新按鈕
   - 選擇「開會」（白色outline按鈕）

2. **選擇時間區間**：
   - 使用時間選擇器設定開始時間
   - 設定結束時間
   - 系統會自動驗證時間邏輯

3. **確認設定**：
   - 點擊「設定開會時間」確認
   - 成功後抽屜會自動關閉並更新狀態

##### 管理已設定的開會時間
1. **查看開會時間**：
   - 在醫師動態更新抽屜中，已設定的開會時間會以藍色區塊顯示
   - 顯示格式：「開會時間：HH:MM - HH:MM」

2. **刪除開會時間**：
   - 點擊開會時間區塊右側的垃圾桶圖示
   - 確認刪除後，開會時間將被移除
   - 醫師狀態會相應更新

#### 無障礙性功能 (v0.9.3 改進)

##### 鍵盤導航支援
- **Tab鍵**：依序導航至各個可操作元素
- **Enter/Space鍵**：啟動按鈕和連結
- **ESC鍵**：關閉對話框和抽屜

##### ARIA標籤優化
- 所有對話框和抽屜都配置了適當的ARIA屬性
- 支援`aria-labelledby`、`aria-modal`、`role="dialog"`等標籤
- 確保螢幕閱讀器能正確識別和朗讀介面元素

##### 焦點管理改進
- 抽屜開啟時焦點會正確導向第一個可操作元素
- 抽屜關閉時焦點會回到觸發元素
- 解決了`aria-hidden`元素焦點滯留問題

#### UI設計改進 (v0.9.3 扁平化設計)

##### 按鈕設計
- **下班按鈕**：藍色背景 (`color="primary"`)
- **開會按鈕**：白色邊框 (`variant="outlined"`)
- **請假按鈕**：紅色背景 (`backgroundColor: '#d32f2f'`)
- **所有按鈕**：移除陰影效果 (`boxShadow: 'none'`)

##### 視覺層次優化
- 統一按鈕高度和間距
- 優化色彩對比度，提升可讀性
- 簡化視覺元素，注重內容呈現

#### 錯誤處理與用戶體驗

##### 錯誤處理機制
- **API錯誤**：顯示友善的錯誤訊息
- **網路錯誤**：提供重試機制
- **輸入驗證**：即時驗證使用者輸入

##### 成功操作回饋
- 操作成功後顯示確認訊息
- 自動更新相關狀態和顯示
- 抽屜和對話框自動關閉

#### 資料更新機制
- **即時更新**：定時任務自動獲取最新資料
- **更新日誌**：系統記錄所有更新操作的詳細日誌
- **錯誤處理**：完整的錯誤捕獲與恢復機制
- **狀態同步**：前後端狀態即時同步

### 7. 換班管理

換班系統提供完整的換班申請與審核流程：

#### 申請換班 (一般護理師)
1. **選擇換班日期**：選擇要換班的日期
2. **選擇換班對象**：選擇要與誰換班
3. **輸入申請原因**：說明換班原因
4. **提交申請**：系統自動驗證工時規則

#### 審核換班 (護理長)
1. **查看申請列表**：檢視所有換班申請
2. **審核申請**：同意或拒絕換班申請
3. **查看歷史記錄**：查看所有換班歷史

#### 智能驗證功能
- **班別衝突檢查**：避免排班衝突
- **工時規則驗證**：確保符合勞基法規定
- **休息時間檢查**：確保護理師有足夠休息時間

### 8. 加班管理

#### 加班人員識別
- **自動識別**：系統自動識別月班表中的A班人員
- **排序標記**：A班人員按A-F順序排列
- **分數計算**：自動計算每月加班分數

#### 加班記錄管理 (護理長)
- **編輯加班人員**：調整加班人員名單
- **批量更新**：一次更新多筆加班記錄
- **統計查詢**：查看年度加班統計

#### 加班分數系統
- **月度計算**：每月自動計算加班分數
- **年度統計**：顯示1-12月加班分數統計表
- **身份區分**：專科護理師和Leader分開計算

### 9. 公告專區

#### 發布公告 (護理長)
1. **撰寫公告標題**
2. **輸入公告內容**
3. **選擇公告分類**
4. **設定重要性**：可標記為重要公告
5. **發布公告**

#### 查看公告 (所有用戶)
- **公告列表**：分頁顯示所有公告
- **分類篩選**：按分類篩選公告
- **重要公告**：重要公告會突出顯示
- **搜尋功能**：可搜尋公告內容

### 10. 系統設定

#### 個人資料設定
- **修改個人資訊**：更新姓名、聯絡資訊等
- **變更密碼**：修改登入密碼

#### Passkey管理
- **註冊Passkey**：註冊新的Passkey裝置
- **管理Passkey**：查看和刪除已註冊的Passkey
- **裝置限制**：一個裝置只能綁定一個帳號

#### 系統資訊
- **版本資訊**：查看系統版本和更新記錄
- **使用統計**：查看系統使用統計資訊

## 操作技巧

### 1. 鍵盤快捷鍵
- **Tab鍵**：在班表編輯中快速切換格子
- **Enter鍵**：確認輸入
- **ESC鍵**：取消編輯

### 2. 手機使用技巧
- **橫式顯示**：建議橫式使用以獲得更好的班表檢視體驗
- **滑動操作**：支援滑動切換月份和週別
- **縮放功能**：可縮放班表以查看詳細資訊

### 3. 班表編輯技巧
- **批次編輯**：可選擇多個格子進行批次修改
- **複製貼上**：支援班別的複製貼上操作
- **自動儲存**：系統會自動儲存編輯內容

## 常見問題 (FAQ)

### Q1: 忘記密碼怎麼辦？
A: 請聯絡系統管理者重設密碼，或使用Passkey登入（如已設定）。

### Q2: Passkey無法使用？
A: 請確認：
- 瀏覽器支援WebAuthn
- 裝置支援生物辨識或PIN碼
- 裝置未被其他帳號綁定

### Q3: 無法生成月班表？
A: 請確認：
- 已設定公式班表
- 護理師已分配到相應組別
- 檢查護理師身份設定是否正確

### Q4: 換班申請被拒絕？
A: 可能原因：
- 工時規則不符合規定
- 班別衝突
- 休息時間不足
- 護理長手動拒絕

### Q5: 醫師班表資料不正確？
A: 醫師班表資料來源於外部API，如有問題請：
- 檢查網路連線
- 等待系統自動更新（每5分鐘）
- 聯絡系統管理者

## 系統維護

### 資料備份
- 系統會自動進行定期資料備份
- 重要操作會記錄在系統日誌中

### 效能優化
- 定期清理過期的日誌記錄
- 優化資料庫查詢效能
- 壓縮靜態資源

### 安全性
- 定期更新密碼
- 管理Passkey裝置
- 監控異常登入行為

## 技術支援

如遇到系統問題，請提供以下資訊：
- 問題發生時間
- 具體操作步驟
- 錯誤訊息截圖
- 使用的瀏覽器和作業系統

聯絡方式：
- GitHub Issues: https://github.com/Claramane/ANES_Management/issues
- 系統管理者：請聯絡資訊部門

## 版本更新說明

### v0.9.3 主要更新
- ✨ 新增醫師班表系統
- 🎨 UI扁平化設計改造
- 📱 優化移動設備體驗
- 🔄 自動定時更新機制
- 📊 醫師班表資料視覺化

### 未來更新計劃
- 班表版本管理系統
- 與開刀房刀表系統整合
- 病人自費項目清單連結
- 醫師管理系統功能擴充

---

*最後更新：2024年12月 | 版本：v0.9.3* 
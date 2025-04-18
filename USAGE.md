# 護理班表管理系統使用指南

## 一、安裝與配置

### 後端設置

1. **安裝依賴**

   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **環境配置**

   將 `.env.example` 複製為 `.env` 並根據需要修改其中的配置：

   ```bash
   cp .env.example .env
   ```

3. **初始化數據庫**

   ```bash
   python init_db.py
   ```

   這將創建數據庫表格並添加初始數據，包括：
   - 管理員用戶 (admin/changeme)
   - 測試護理師用戶 (nurse/password)
   - 默認公告分類
   - 默認班別規則

### 前端設置

1. **安裝依賴**

   ```bash
   cd frontend
   npm install
   ```

## 二、啟動應用

### 啟動後端

```bash
cd backend
python run.py
```

### 啟動前端

```bash
cd frontend
npm start
```

系統將在 http://localhost:3000 啟動。

## 三、用戶角色與功能

### 護理長 (admin)

護理長擁有系統的完整管理權限，功能包括：

1. **公式班表管理**
   - 創建/編輯/刪除公式班表
   - 指派護理師至公式班組
   - 設置護理師的公式班循環起始週期

2. **班表管理**
   - 基於公式班表生成月度班表
   - 手動調整班表內容
   - 發布班表，創建版本記錄
   - 控制護理師順序（拖拉排序）

3. **用戶管理**
   - 創建/編輯/刪除用戶
   - 設置用戶角色與身份

4. **公告管理**
   - 發布各類公告
   - 設置公告分類
   - 設置不同身份的發布權限

5. **系統設置**
   - 設置班別規則（工作時間、最小休息時間等）
   - 配置公告分類權限

### 護理師 (nurse)

護理師可以使用以下功能：

1. **班表查詢**
   - 查看個人週班表
   - 查看月班表
   - 查看大班表（所有人員）

2. **換班功能**
   - 提交換班申請
   - 接受其他護理師的換班申請
   - 查看換班歷史

3. **公告查看**
   - 瀏覽所有公告
   - 在有權限的分類下發布公告（默認僅「閒聊」分類）

## 四、基本操作流程

### 班表管理流程（護理長）

1. **設置公式班表**
   - 創建多個公式班組（如週一到週日的班別組合）
   - 將護理師指派到特定公式班組
   - 設置循環起始週期

2. **生成月度班表**
   - 選擇年月，生成月度班表
   - 審核並根據需要調整生成的班表
   - 發布班表，生成版本快照

### 換班申請流程（護理師）

1. **提交換班申請**
   - 選擇欲換掉的班別（日期、班型、房區）
   - 選擇欲換入的班別（日期、班型、房區）
   - 提交申請

2. **接受換班申請**
   - 瀏覽換班申請列表
   - 查看符合自己條件的申請
   - 接受申請（系統自動進行規則驗證）

## 五、注意事項

1. **IP限制**：護理長帳號採用IP限制，同一時間只允許從一個IP地址登入。

2. **換班規則**：系統根據設定的換班規則（最小休息時間、工時限制等）自動驗證換班申請的合法性。

3. **版本控制**：每次發布班表會創建一個新版本，保留修改歷史，可進行版本比對。

4. **數據備份**：正式環境建議定期備份數據庫，確保數據安全。

## 六、默認帳號信息

1. **護理長**
   - 用戶名：admin
   - 密碼：changeme（首次登入後建議修改）

2. **測試護理師**
   - 用戶名：nurse
   - 密碼：password 
# 醫師員工編號映射設置說明

## 功能描述
前端可以透過環境變數來顯示醫師的員工編號（employee_id），在醫師姓名後面以括號形式顯示，例如：`林怡芸 (01757)`

## 環境變數設置

### 環境變數名稱
```
REACT_APP_DOCTOR_EMPLOYEE_MAPPING
```

### 環境變數值格式
JSON字符串陣列，包含醫師姓名和員工編號的映射：

```json
[{"name": "林怡芸", "employee_id": "01757"}, {"name": "游雅盛", "employee_id": "01221"}, {"name": "陳燁晨", "employee_id": "02003"}, {"name": "顏任軒", "employee_id": "02002"}, {"name": "吳佩諭", "employee_id": "01161"}, {"name": "史若蘭", "employee_id": "00013"}, {"name": "陳品臣", "employee_id": "02106"}, {"name": "陳柏羽", "employee_id": "02109"}]
```

## 在 Zeabur 上設置環境變數

1. 登入 Zeabur 控制台
2. 選擇您的專案
3. 進入前端服務設定
4. 找到「Environment Variables」或「環境變數」設定
5. 新增環境變數：
   - **變數名稱**: `REACT_APP_DOCTOR_EMPLOYEE_MAPPING`
   - **變數值**: 上述的JSON字符串

## 本地開發設置

在前端專案根目錄創建 `.env.local` 文件：

```bash
# .env.local
REACT_APP_DOCTOR_EMPLOYEE_MAPPING=[{"name": "林怡芸", "employee_id": "01757"}, {"name": "游雅盛", "employee_id": "01221"}, {"name": "陳燁晨", "employee_id": "02003"}, {"name": "顏任軒", "employee_id": "02002"}, {"name": "吳佩諭", "employee_id": "01161"}, {"name": "史若蘭", "employee_id": "00013"}, {"name": "陳品臣", "employee_id": "02106"}, {"name": "陳柏羽", "employee_id": "02109"}]
```

## 功能特點

- **自動容錯**: 如果未設置環境變數，會正常顯示醫師姓名（不含員工編號）
- **部分映射**: 如果某位醫師在映射中不存在，只顯示姓名
- **JSON解析錯誤處理**: 如果JSON格式錯誤，會在控制台顯示錯誤訊息並回退到預設行為

## 顯示效果

- **未設置環境變數**: `林怡芸`
- **已設置環境變數**: `林怡芸 (01757)`
- **醫師不在映射中**: `其他醫師` (保持原樣)

## 技術實現

相關文件：
- `frontend/src/utils/doctorUtils.js` - 醫師資料處理工具函數
- `frontend/src/pages/DoctorSchedule.jsx` - 醫師班表頁面，使用了格式化函數

## 注意事項

1. 環境變數必須以 `REACT_APP_` 開頭才能在前端被讀取
2. JSON字符串中不能有換行或額外的空格
3. 醫師姓名必須與後端返回的姓名完全匹配
4. 修改環境變數後需要重新部署前端應用才會生效 
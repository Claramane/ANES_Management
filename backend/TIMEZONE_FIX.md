# 時區修復說明

## 問題描述

本地環境與雲端部署環境的時區不一致，導致醫師自動下班和開會狀態檢測功能失效。

## 根本原因

1. **後端時區問題**：
   - 原本混用 `datetime.now()` 和 `datetime.utcnow()`
   - 雲端部署時伺服器使用 UTC 時區，與台灣時區（UTC+8）相差 8 小時

2. **前端時區處理**：
   - 前端手動進行 UTC+8 時間轉換
   - 與後端時區不一致時會產生錯誤

## 修復措施

### 1. 後端修復

#### 統一時區處理
- 在 `main.py` 中設定 `TZ=Asia/Taipei` 環境變數
- 在 `models/doctor_schedule.py` 中定義台灣時區函數
- 在 `services/doctor_schedule_service.py` 中統一使用台灣時區

#### 關鍵修改
```python
# 定義台灣時區
TAIWAN_TZ = timezone(timedelta(hours=8))

def taiwan_now():
    """返回台灣當前時間"""
    return datetime.now(TAIWAN_TZ)

# 所有時間相關操作都使用台灣時區
current_time = cls.get_taiwan_now().time()
today = cls.get_taiwan_today_str()
```

### 2. 前端修復

#### 移除手動時區轉換
```javascript
// 修改前：手動轉換UTC+8
const utc8Now = new Date(now.getTime() + (8 * 60 * 60 * 1000));

// 修改後：直接使用本地時間
const now = new Date();
const currentHour = now.getHours();
```

### 3. 部署配置

#### Docker 環境變數
```yaml
# docker-compose.yml
environment:
  - TZ=Asia/Taipei
```

#### 應用啟動時設定
```python
# main.py
os.environ['TZ'] = 'Asia/Taipei'
try:
    import time
    time.tzset()  # Unix系統設定時區
except (ImportError, AttributeError):
    pass  # Windows系統不支援
```

## 測試驗證

### 本地測試
```bash
# 檢查時區設定
python -c "import os; print(f'TZ={os.environ.get(\"TZ\", \"未設定\")}')"

# 檢查當前時間
python -c "from datetime import datetime; print(f'當前時間: {datetime.now()}')"
```

### 雲端部署測試
1. 檢查應用日誌中的時區設定記錄
2. 測試醫師在工作時間內的狀態
3. 測試開會時間的自動狀態切換

## 部署注意事項

1. **環境變數**：確保雲端平台設定 `TZ=Asia/Taipei`
2. **日誌檢查**：部署後檢查日誌中的時區設定記錄
3. **功能測試**：部署後測試自動下班和開會狀態功能

## 相關文件

- `backend/app/services/doctor_schedule_service.py` - 主要時區邏輯
- `backend/app/models/doctor_schedule.py` - 資料庫時區設定
- `backend/main.py` - 應用啟動時區設定
- `frontend/src/pages/DoctorSchedule.jsx` - 前端時區處理

## 預期效果

修復後，無論在本地開發環境還是雲端部署環境，都應該能夠：
1. 正確檢測醫師工作時間
2. 自動設定醫師下班狀態
3. 正確顯示開會中狀態
4. 開會結束後自動恢復上班狀態 
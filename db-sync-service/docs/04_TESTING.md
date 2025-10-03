# 測試計劃文件

## 🧪 測試策略

### 測試層級
1. **單元測試** - 測試個別函數和類別
2. **整合測試** - 測試模組間互動
3. **系統測試** - 測試完整同步流程
4. **部署測試** - 驗證 Zeabur 部署

---

## 單元測試

### 測試 1: 配置驗證 (`config.py`)

#### 測試案例 1.1: 環境變數讀取
```python
def test_config_load_env():
    """測試從環境變數載入配置"""
    # Given
    os.environ['SOURCE_DB_URL'] = 'postgresql://test'
    os.environ['SYNC_TARGETS'] = 'local,test'

    # When
    config = Config.from_env()

    # Then
    assert config.SOURCE_DB_URL == 'postgresql://test'
    assert config.SYNC_TARGETS == ['local', 'test']
```

#### 測試案例 1.2: 缺少必要配置
```python
def test_config_missing_required():
    """測試缺少必要環境變數時應拋出錯誤"""
    # Given
    os.environ.clear()

    # When & Then
    with pytest.raises(ValueError, match="SOURCE_DB_URL is required"):
        Config.from_env()
```

#### 測試案例 1.3: 目標配置驗證
```python
def test_config_target_validation():
    """測試目標配置與 SYNC_TARGETS 一致性"""
    # Given
    os.environ['SYNC_TARGETS'] = 'local,test'
    # 缺少 TARGET_TEST_URL

    # When & Then
    config = Config.from_env()
    with pytest.raises(ValueError, match="TARGET_TEST_URL not found"):
        config.validate()
```

### 測試 2: 同步邏輯 (`sync_worker.py`)

#### 測試案例 2.1: 增量資料查詢
```python
async def test_get_incremental_data():
    """測試增量資料查詢邏輯"""
    # Given
    worker = SyncWorker(source_url, config)
    last_sync_time = datetime(2025, 10, 3, 10, 0, 0)

    # When
    data = await worker.get_incremental_data('users', last_sync_time)

    # Then
    assert all(row['updated_at'] > last_sync_time for row in data)
```

#### 測試案例 2.2: 無時間戳表格處理
```python
async def test_table_without_timestamp():
    """測試無 updated_at 欄位的表格應執行全量同步"""
    # Given
    worker = SyncWorker(source_url, config)

    # When
    data = await worker.get_incremental_data('schedule_changes', None)

    # Then
    assert len(data) > 0  # 應返回全量資料
```

#### 測試案例 2.3: UPSERT 邏輯
```python
async def test_upsert_data():
    """測試 UPSERT 邏輯（存在則更新，不存在則插入）"""
    # Given
    data = [{'id': 1, 'name': 'updated'}, {'id': 999, 'name': 'new'}]

    # When
    count = await worker.upsert_data('users', data, target_conn)

    # Then
    assert count == 2
    # 驗證 id=1 已更新
    # 驗證 id=999 已插入
```

### 測試 3: 同步狀態管理

#### 測試案例 3.1: 狀態儲存與讀取
```python
def test_sync_state_save_load():
    """測試同步狀態儲存和讀取"""
    # Given
    state_manager = SyncStateManager('test_sync_state.json')
    sync_time = datetime.now()

    # When
    state_manager.update_sync_state('users', sync_time, 50)
    state_manager.save_state()

    # Then
    loaded_time = state_manager.get_last_sync_time('users')
    assert loaded_time == sync_time
```

#### 測試案例 3.2: 首次同步
```python
def test_first_sync_no_state():
    """測試首次同步時無狀態檔案"""
    # Given
    state_manager = SyncStateManager('nonexistent.json')

    # When
    last_sync = state_manager.get_last_sync_time('users')

    # Then
    assert last_sync is None  # 應返回 None
```

---

## 整合測試

### 測試 4: 資料庫連線

#### 測試案例 4.1: 來源資料庫連線
```python
async def test_source_db_connection():
    """測試連接正式環境資料庫"""
    # When
    conn = await asyncpg.connect(config.SOURCE_DB_URL)

    # Then
    result = await conn.fetchval("SELECT 1")
    assert result == 1
    await conn.close()
```

#### 測試案例 4.2: 目標資料庫連線
```python
async def test_target_db_connections():
    """測試連接所有目標資料庫"""
    for target_name, target_url in config.target_urls.items():
        conn = await asyncpg.connect(target_url)
        result = await conn.fetchval("SELECT 1")
        assert result == 1
        await conn.close()
```

#### 測試案例 4.3: 表格結構一致性
```python
async def test_table_structure_consistency():
    """測試來源和目標的表格結構一致"""
    # Given
    source_conn = await asyncpg.connect(config.SOURCE_DB_URL)
    target_conn = await asyncpg.connect(config.target_urls['test'])

    # When
    source_columns = await get_table_columns(source_conn, 'users')
    target_columns = await get_table_columns(target_conn, 'users')

    # Then
    assert source_columns == target_columns
```

### 測試 5: 多目標同步

#### 測試案例 5.1: 並行同步到多個目標
```python
async def test_sync_multiple_targets():
    """測試同時同步到多個目標環境"""
    # Given
    worker = SyncWorker(config.SOURCE_DB_URL, config)

    # When
    await worker.sync_all_targets()

    # Then
    # 驗證所有目標都已更新
    for target_url in config.target_urls.values():
        conn = await asyncpg.connect(target_url)
        count = await conn.fetchval("SELECT COUNT(*) FROM users")
        assert count > 0
```

---

## 系統測試

### 測試 6: 完整同步流程

#### 測試案例 6.1: 首次全量同步
```python
async def test_full_sync_first_time():
    """測試首次全量同步"""
    # Given
    清空目標資料庫
    刪除 sync_state.json

    # When
    執行 main.py

    # Then
    # 驗證所有表格都已同步
    # 驗證資料數量一致
    # 驗證 sync_state.json 已建立
```

#### 測試案例 6.2: 增量同步
```python
async def test_incremental_sync():
    """測試增量同步"""
    # Given
    已執行首次同步
    在正式環境新增 5 筆 users 資料
    等待 1 分鐘

    # When
    執行同步

    # Then
    # 應只同步新增的 5 筆
    # sync_state.json 應更新
```

#### 測試案例 6.3: 外鍵順序驗證
```python
async def test_foreign_key_order():
    """測試外鍵依賴順序正確"""
    # Given
    清空目標資料庫
    正式環境有完整的關聯資料

    # When
    執行同步

    # Then
    # 應無外鍵錯誤
    # 所有資料正確同步
```

### 測試 7: 錯誤處理

#### 測試案例 7.1: 資料庫連線失敗
```python
async def test_db_connection_failure():
    """測試資料庫連線失敗時的處理"""
    # Given
    錯誤的資料庫 URL

    # When
    執行同步

    # Then
    # 應記錄錯誤日誌
    # 應進行重試
    # 重試失敗後應優雅退出
```

#### 測試案例 7.2: 單一表格同步失敗
```python
async def test_single_table_sync_failure():
    """測試單一表格失敗不影響其他表格"""
    # Given
    模擬 'users' 表格同步失敗

    # When
    執行同步

    # Then
    # 'users' 失敗應被記錄
    # 其他表格應繼續同步
```

#### 測試案例 7.3: 資料衝突處理
```python
async def test_data_conflict():
    """測試資料衝突時的 UPSERT 行為"""
    # Given
    目標環境已有 id=1 的 user
    正式環境的 id=1 user 已更新

    # When
    執行同步

    # Then
    # 應更新而非插入
    # 資料應以正式環境為準
```

---

## 部署測試

### 測試 8: Zeabur 部署驗證

#### 測試案例 8.1: Docker 建置
```bash
# 本地測試 Docker 建置
docker build -t db-sync-service .
docker run --env-file .env db-sync-service

# 預期：成功建置並執行
```

#### 測試案例 8.2: 環境變數注入
```bash
# 測試環境變數是否正確注入
docker run --env SOURCE_DB_URL=$SOURCE_DB_URL db-sync-service

# 預期：服務正確讀取環境變數
```

#### 測試案例 8.3: 持續運行
```bash
# 測試服務是否持續運行
docker run -d db-sync-service
sleep 30
docker logs [container_id]

# 預期：看到同步日誌，無錯誤
```

### 測試 9: Zeabur 環境測試

#### 測試清單 9.1: 部署後驗證
- [ ] 服務成功啟動
- [ ] 環境變數正確載入
- [ ] 資料庫連線成功
- [ ] 首次同步執行成功
- [ ] 日誌正常輸出
- [ ] 無錯誤訊息

#### 測試清單 9.2: 功能驗證
- [ ] 增量同步正常運作
- [ ] sync_state.json 正確更新
- [ ] 多目標同步正常
- [ ] 敏感欄位已排除
- [ ] 外鍵順序正確

#### 測試清單 9.3: 監控驗證
- [ ] Zeabur 日誌可查看
- [ ] 同步統計正確
- [ ] 錯誤告警設定（如有）
- [ ] 服務自動重啟測試

---

## 效能測試

### 測試 10: 同步效能

#### 測試案例 10.1: 大數據量同步
```python
async def test_large_data_sync():
    """測試大數據量同步效能"""
    # Given
    正式環境有 50,000+ 筆資料

    # When
    執行全量同步
    記錄耗時

    # Then
    # 耗時應 < 5 分鐘
    # 記憶體使用 < 512 MB
```

#### 測試案例 10.2: 批次處理效能
```python
def test_batch_size_performance():
    """測試不同批次大小的效能"""
    # 測試 BATCH_SIZE = 100, 500, 1000, 5000
    # 記錄各自的耗時和記憶體使用
    # 找出最佳批次大小
```

---

## 安全測試

### 測試 11: 安全性驗證

#### 測試案例 11.1: 敏感資料排除
```python
async def test_sensitive_fields_excluded():
    """測試敏感欄位是否被排除"""
    # When
    執行同步

    # Then
    target_conn = await asyncpg.connect(target_url)
    users = await target_conn.fetch("SELECT * FROM users")

    for user in users:
        assert user['password'] is None  # 應為 NULL 或空
```

#### 測試案例 11.2: 單向同步保護
```python
def test_prevent_reverse_sync():
    """測試防止反向同步"""
    # Given
    config.SOURCE_DB_URL = target_url  # 錯誤設定

    # When & Then
    with pytest.raises(ValueError, match="不允許反向同步"):
        worker = SyncWorker(config.SOURCE_DB_URL, config)
```

---

## 測試執行計劃

### 本地測試階段

1. **單元測試**
   ```bash
   pytest tests/unit/ -v
   ```

2. **整合測試**
   ```bash
   pytest tests/integration/ -v
   ```

3. **系統測試**
   ```bash
   python test_full_sync.py
   ```

### 部署前測試

1. **Docker 建置測試**
   ```bash
   docker build -t db-sync-service .
   docker run --env-file .env.test db-sync-service
   ```

2. **資料驗證**
   ```bash
   python verify_data_consistency.py
   ```

### Zeabur 部署測試

1. **部署到測試專案**
2. **執行驗證測試**
3. **監控 24 小時**
4. **確認無誤後部署正式**

---

## 測試工具和腳本

### 測試腳本 1: 資料一致性驗證

**`verify_data_consistency.py`**:
```python
async def verify_consistency():
    """驗證來源和目標資料一致性"""
    source_conn = await asyncpg.connect(SOURCE_DB_URL)
    target_conn = await asyncpg.connect(TARGET_DB_URL)

    for table in TABLES:
        source_count = await source_conn.fetchval(f"SELECT COUNT(*) FROM {table}")
        target_count = await target_conn.fetchval(f"SELECT COUNT(*) FROM {table}")

        if source_count != target_count:
            print(f"❌ {table}: source={source_count}, target={target_count}")
        else:
            print(f"✅ {table}: {source_count} records")
```

### 測試腳本 2: 效能基準測試

**`benchmark_sync.py`**:
```python
async def benchmark():
    """效能基準測試"""
    start_time = time.time()

    await worker.sync_all_targets()

    elapsed = time.time() - start_time
    print(f"同步耗時: {elapsed:.2f} 秒")
```

---

## 測試檢查清單

### 開發階段
- [ ] 所有單元測試通過
- [ ] 所有整合測試通過
- [ ] 代碼覆蓋率 > 80%

### 部署前
- [ ] Docker 建置成功
- [ ] 本地環境測試通過
- [ ] 資料一致性驗證通過
- [ ] 效能測試通過
- [ ] 安全性測試通過

### 部署後
- [ ] Zeabur 部署成功
- [ ] 服務正常運行
- [ ] 首次同步成功
- [ ] 增量同步正常
- [ ] 日誌監控設定
- [ ] 運行 24 小時無錯誤

---

**文件版本**: v1.0
**最後更新**: 2025-10-03

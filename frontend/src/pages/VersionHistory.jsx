import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Paper, 
  Box, 
  Grid, 
  Tab, 
  Tabs, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton
} from '@mui/material';
import { 
  ExpandMore as ExpandMoreIcon, 
  HistoryToggleOff as HistoryIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Edit as EditIcon,
  Restore as RestoreIcon,
  Compare as CompareIcon,
  CalendarMonth as CalendarIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { api } from '../utils/api';

// 自訂TabPanel元件
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`version-history-tabpanel-${index}`}
      aria-labelledby={`version-history-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function VersionHistory() {
  const [tabValue, setTabValue] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [availableMonths, setAvailableMonths] = useState([]);
  const [versions, setVersions] = useState([]);
  const [diffs, setDiffs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDiff, setSelectedDiff] = useState(null);
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState({
    version1: null,
    version2: null
  });
  const [compareResult, setCompareResult] = useState(null);

  // 獲取可用的月份
  useEffect(() => {
    const fetchAvailableMonths = async () => {
      try {
        const response = await api.get('/schedules/versions/months');
        if (response.data) {
          const months = response.data.sort((a, b) => b.localeCompare(a)); // 降序排列
          setAvailableMonths(months);
          if (months.length > 0) {
            setSelectedMonth(months[0]);
          }
        }
      } catch (err) {
        console.error('獲取可用月份失敗:', err);
        setError('獲取可用月份失敗');
      }
    };

    fetchAvailableMonths();
  }, []);

  // 當選擇的月份變更時獲取該月的版本
  useEffect(() => {
    if (selectedMonth) {
      fetchVersions(selectedMonth);
      fetchDiffs(selectedMonth);
    }
  }, [selectedMonth]);

  // 獲取指定月份的版本
  const fetchVersions = async (month) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/schedules/versions?month=${month}`);
      // 直接使用response.data，不假設它有success屬性
      setVersions(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('獲取版本失敗:', err);
      setError('獲取版本失敗');
    } finally {
      setLoading(false);
    }
  };

  // 獲取指定月份的差異記錄
  const fetchDiffs = async (month) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/schedules/versions/diffs?month=${month}`);
      // 直接使用response.data，不假設它的格式
      setDiffs(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('獲取差異記錄失敗:', err);
      setError('獲取差異記錄失敗');
    } finally {
      setLoading(false);
    }
  };

  // 獲取特定差異記錄的詳細資訊
  const fetchDiffDetail = async (diffId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/schedules/versions/diffs/${diffId}`);
      if (response.data) {
        setSelectedDiff(response.data);
        setOpenDetailDialog(true);
      } else {
        setError('無法獲取差異詳情');
      }
    } catch (err) {
      console.error('獲取差異詳情失敗:', err);
      setError('獲取差異詳情失敗');
    } finally {
      setLoading(false);
    }
  };

  // 比較兩個版本
  const compareVersions = async () => {
    if (!selectedVersions.version1 || !selectedVersions.version2) {
      setError('請選擇兩個要比較的版本');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/schedules/versions/compare', {
        version_id1: selectedVersions.version1,
        version_id2: selectedVersions.version2
      });
      if (response.data) {
        setCompareResult(response.data);
        setCompareDialogOpen(true);
      } else {
        setError('版本比較未返回結果');
      }
    } catch (err) {
      console.error('比較版本失敗:', err);
      setError('比較版本失敗');
    } finally {
      setLoading(false);
    }
  };

  // 從差異記錄恢復版本
  const restoreFromDiff = async (baseVersionId, diffId, newVersionNumber) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/schedules/versions/restore-from-diff', {
        base_version_id: baseVersionId,
        diff_id: diffId,
        new_version_number: newVersionNumber,
        notes: `從基準版本和差異記錄恢復的版本 (${format(new Date(), 'yyyy-MM-dd HH:mm')})`
      });
      
      // 檢查響應中是否包含有效數據
      if (response.data && (response.data.id || response.data.success)) {
        // 重新獲取版本列表
        fetchVersions(selectedMonth);
        alert('版本恢復成功！');
      } else {
        setError((response.data && response.data.message) || '恢復版本失敗');
      }
    } catch (err) {
      console.error('恢復版本失敗:', err);
      setError('恢復版本失敗');
    } finally {
      setLoading(false);
    }
  };

  // 處理標籤變更
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // 處理月份選擇變更
  const handleMonthChange = (event) => {
    setSelectedMonth(event.target.value);
  };

  // 格式化YYYYMM為YYYY年MM月
  const formatMonth = (yyyymm) => {
    if (!yyyymm || yyyymm.length !== 6) return yyyymm;
    return `${yyyymm.substring(0, 4)}年${yyyymm.substring(4)}月`;
  };

  // 格式化日期時間
  const formatDateTime = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return format(date, 'yyyy-MM-dd HH:mm:ss', { locale: zhTW });
    } catch (err) {
      return dateStr;
    }
  };

  // 獲取變更類型的顏色和標籤
  const getChangeTypeInfo = (type) => {
    switch (type) {
      case 'added':
        return { color: 'success', label: '新增', icon: <AddIcon /> };
      case 'modified':
        return { color: 'warning', label: '修改', icon: <EditIcon /> };
      case 'deleted':
        return { color: 'error', label: '刪除', icon: <RemoveIcon /> };
      default:
        return { color: 'default', label: type, icon: null };
    }
  };

  return (
    <Container maxWidth="lg">
      <Paper sx={{ p: 3, mt: 3 }}>
        <Box display="flex" alignItems="center" mb={2}>
          <HistoryIcon sx={{ mr: 1 }} />
          <Typography variant="h5" component="h1">
            班表歷史紀錄
          </Typography>
        </Box>

        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth variant="outlined">
            <InputLabel id="month-select-label">選擇月份</InputLabel>
            <Select
              labelId="month-select-label"
              id="month-select"
              value={selectedMonth}
              onChange={handleMonthChange}
              label="選擇月份"
              disabled={loading || availableMonths.length === 0}
            >
              {availableMonths.map((month) => (
                <MenuItem key={month} value={month}>
                  {formatMonth(month)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="版本歷史標籤">
            <Tab label="版本列表" id="version-history-tab-0" />
            <Tab label="差異記錄" id="version-history-tab-1" />
            <Tab label="版本比較" id="version-history-tab-2" />
          </Tabs>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* 版本列表標籤頁 */}
        <TabPanel value={tabValue} index={0}>
          {!loading && versions.length === 0 ? (
            <Alert severity="info">
              尚無版本記錄
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>版本編號</TableCell>
                    <TableCell>發布日期</TableCell>
                    <TableCell>發布狀態</TableCell>
                    <TableCell>基準版本</TableCell>
                    <TableCell>備註</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {versions.map((version) => (
                    <TableRow key={version.id} hover>
                      <TableCell>
                        {version.version_number}
                      </TableCell>
                      <TableCell>
                        {formatDateTime(version.published_at)}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          color={version.is_published ? "success" : "default"} 
                          size="small" 
                          label={version.is_published ? "已發布" : "未發布"} 
                        />
                      </TableCell>
                      <TableCell>
                        {version.is_base_version ? (
                          <Chip 
                            color="primary" 
                            size="small" 
                            icon={<CalendarIcon />} 
                            label="基準版本" 
                          />
                        ) : "否"}
                      </TableCell>
                      <TableCell>{version.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* 差異記錄標籤頁 */}
        <TabPanel value={tabValue} index={1}>
          {!loading && diffs.length === 0 ? (
            <Alert severity="info">
              尚無差異記錄
            </Alert>
          ) : (
            <div>
              {diffs.map((diff) => (
                <Accordion key={diff.id} sx={{ mb: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Grid container alignItems="center" spacing={2}>
                      <Grid item>
                        <Typography variant="subtitle1">
                          差異記錄 #{diff.id}
                        </Typography>
                      </Grid>
                      <Grid item>
                        <Typography variant="body2" color="text.secondary">
                          創建於: {formatDateTime(diff.created_at)}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm>
                        <Typography variant="body2">
                          {diff.base_version?.version_number} → {diff.version?.version_number}
                        </Typography>
                      </Grid>
                      <Grid item>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Chip size="small" color="success" label={`新增: ${diff.diff_data?.added?.length || 0}`} />
                          <Chip size="small" color="warning" label={`修改: ${diff.diff_data?.modified?.length || 0}`} />
                          <Chip size="small" color="error" label={`刪除: ${diff.diff_data?.deleted?.length || 0}`} />
                        </Box>
                      </Grid>
                    </Grid>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        startIcon={<RestoreIcon />}
                        onClick={() => {
                          const newVersionNumber = prompt(
                            "請輸入新版本號碼:",
                            `v${Date.now().toString(36)}_${selectedMonth}`
                          );
                          if (newVersionNumber) {
                            restoreFromDiff(diff.base_version_id, diff.id, newVersionNumber);
                          }
                        }}
                      >
                        恢復此版本
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => fetchDiffDetail(diff.id)}
                        startIcon={<CompareIcon />}
                      >
                        查看詳細差異
                      </Button>
                    </Box>

                    {/* 差異摘要 */}
                    <Typography variant="subtitle2" gutterBottom>
                      變更摘要:
                    </Typography>
                    <Box sx={{ maxHeight: '200px', overflow: 'auto', mb: 2 }}>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>變更類型</TableCell>
                              <TableCell>人員</TableCell>
                              <TableCell>日期</TableCell>
                              <TableCell>變更內容</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {/* 新增的排班 */}
                            {diff.diff_data?.added?.slice(0, 5).map((item, idx) => {
                              const typeInfo = getChangeTypeInfo('added');
                              return (
                                <TableRow key={`added-${idx}`}>
                                  <TableCell>
                                    <Chip
                                      size="small"
                                      color={typeInfo.color}
                                      icon={typeInfo.icon}
                                      label={typeInfo.label}
                                    />
                                  </TableCell>
                                  <TableCell>{item.user_name || `ID: ${item.user_id}`}</TableCell>
                                  <TableCell>{item.date}</TableCell>
                                  <TableCell>{`新增 ${item.shift_type} 班`}</TableCell>
                                </TableRow>
                              );
                            })}

                            {/* 修改的排班 */}
                            {diff.diff_data?.modified?.slice(0, 5).map((item, idx) => {
                              const typeInfo = getChangeTypeInfo('modified');
                              return (
                                <TableRow key={`modified-${idx}`}>
                                  <TableCell>
                                    <Chip
                                      size="small"
                                      color={typeInfo.color}
                                      icon={typeInfo.icon}
                                      label={typeInfo.label}
                                    />
                                  </TableCell>
                                  <TableCell>{item.user_name || `ID: ${item.user_id}`}</TableCell>
                                  <TableCell>{item.date}</TableCell>
                                  <TableCell>{`${item.old.shift_type} → ${item.new.shift_type}`}</TableCell>
                                </TableRow>
                              );
                            })}

                            {/* 刪除的排班 */}
                            {diff.diff_data?.deleted?.slice(0, 5).map((item, idx) => {
                              const typeInfo = getChangeTypeInfo('deleted');
                              return (
                                <TableRow key={`deleted-${idx}`}>
                                  <TableCell>
                                    <Chip
                                      size="small"
                                      color={typeInfo.color}
                                      icon={typeInfo.icon}
                                      label={typeInfo.label}
                                    />
                                  </TableCell>
                                  <TableCell>{item.user_name || `ID: ${item.user_id}`}</TableCell>
                                  <TableCell>{item.date}</TableCell>
                                  <TableCell>{`移除 ${item.shift_type} 班`}</TableCell>
                                </TableRow>
                              );
                            })}

                            {/* 如果有更多變更，顯示查看全部按鈕 */}
                            {(diff.diff_data?.added?.length > 5 || 
                              diff.diff_data?.modified?.length > 5 || 
                              diff.diff_data?.deleted?.length > 5) && (
                              <TableRow>
                                <TableCell colSpan={4} align="center">
                                  <Button 
                                    size="small" 
                                    onClick={() => fetchDiffDetail(diff.id)}
                                    variant="text"
                                  >
                                    查看全部變更 ({(diff.diff_data?.added?.length || 0) + 
                                      (diff.diff_data?.modified?.length || 0) + 
                                      (diff.diff_data?.deleted?.length || 0)} 筆)
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
            </div>
          )}
        </TabPanel>

        {/* 版本比較標籤頁 */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
                <InputLabel>版本 1</InputLabel>
                <Select
                  value={selectedVersions.version1 || ''}
                  onChange={(e) => setSelectedVersions({...selectedVersions, version1: e.target.value})}
                  label="版本 1"
                >
                  <MenuItem value="">請選擇版本</MenuItem>
                  {versions.map((version) => (
                    <MenuItem key={`v1-${version.id}`} value={version.id}>
                      {version.version_number} ({formatDateTime(version.published_at)})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
                <InputLabel>版本 2</InputLabel>
                <Select
                  value={selectedVersions.version2 || ''}
                  onChange={(e) => setSelectedVersions({...selectedVersions, version2: e.target.value})}
                  label="版本 2"
                >
                  <MenuItem value="">請選擇版本</MenuItem>
                  {versions.map((version) => (
                    <MenuItem key={`v2-${version.id}`} value={version.id}>
                      {version.version_number} ({formatDateTime(version.published_at)})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                <Button 
                  variant="contained" 
                  onClick={compareVersions}
                  startIcon={<CompareIcon />}
                  disabled={!selectedVersions.version1 || !selectedVersions.version2}
                >
                  比較版本
                </Button>
              </Box>
            </Grid>
          </Grid>
        </TabPanel>

        {/* 差異詳情對話框 */}
        <Dialog 
          open={openDetailDialog} 
          onClose={() => setOpenDetailDialog(false)}
          fullWidth
          maxWidth="md"
        >
          <DialogTitle>
            差異詳情 - {selectedDiff?.version?.version_number} vs {selectedDiff?.base_version?.version_number}
          </DialogTitle>
          <DialogContent dividers>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <Typography variant="subtitle1" gutterBottom>
                  變更總數: {
                    (selectedDiff?.diff_data?.added?.length || 0) + 
                    (selectedDiff?.diff_data?.modified?.length || 0) + 
                    (selectedDiff?.diff_data?.deleted?.length || 0)
                  } 筆
                </Typography>

                <Box sx={{ mb: 3 }}>
                  <Tabs value={0}>
                    <Tab 
                      label={`新增 (${selectedDiff?.diff_data?.added?.length || 0})`} 
                      icon={<AddIcon />}
                    />
                    <Tab 
                      label={`修改 (${selectedDiff?.diff_data?.modified?.length || 0})`}
                      icon={<EditIcon />} 
                    />
                    <Tab 
                      label={`刪除 (${selectedDiff?.diff_data?.deleted?.length || 0})`}
                      icon={<RemoveIcon />} 
                    />
                  </Tabs>
                </Box>

                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>人員</TableCell>
                        <TableCell>日期</TableCell>
                        <TableCell>原始班別</TableCell>
                        <TableCell>變更後班別</TableCell>
                        <TableCell>變更類型</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {/* 新增的排班 */}
                      {selectedDiff?.diff_data?.added?.map((item, idx) => {
                        const typeInfo = getChangeTypeInfo('added');
                        return (
                          <TableRow key={`detail-added-${idx}`}>
                            <TableCell>{item.user_name || `ID: ${item.user_id}`}</TableCell>
                            <TableCell>{item.date}</TableCell>
                            <TableCell>-</TableCell>
                            <TableCell>{item.shift_type}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                color={typeInfo.color}
                                icon={typeInfo.icon}
                                label={typeInfo.label}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {/* 修改的排班 */}
                      {selectedDiff?.diff_data?.modified?.map((item, idx) => {
                        const typeInfo = getChangeTypeInfo('modified');
                        return (
                          <TableRow key={`detail-modified-${idx}`}>
                            <TableCell>{item.user_name || `ID: ${item.user_id}`}</TableCell>
                            <TableCell>{item.date}</TableCell>
                            <TableCell>{item.old.shift_type}</TableCell>
                            <TableCell>{item.new.shift_type}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                color={typeInfo.color}
                                icon={typeInfo.icon}
                                label={typeInfo.label}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {/* 刪除的排班 */}
                      {selectedDiff?.diff_data?.deleted?.map((item, idx) => {
                        const typeInfo = getChangeTypeInfo('deleted');
                        return (
                          <TableRow key={`detail-deleted-${idx}`}>
                            <TableCell>{item.user_name || `ID: ${item.user_id}`}</TableCell>
                            <TableCell>{item.date}</TableCell>
                            <TableCell>{item.shift_type}</TableCell>
                            <TableCell>-</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                color={typeInfo.color}
                                icon={typeInfo.icon}
                                label={typeInfo.label}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDetailDialog(false)}>關閉</Button>
            <Button 
              color="primary" 
              variant="contained"
              onClick={() => {
                const newVersionNumber = prompt(
                  "請輸入新版本號碼:",
                  `v${Date.now().toString(36)}_${selectedMonth}`
                );
                if (newVersionNumber) {
                  restoreFromDiff(selectedDiff.base_version_id, selectedDiff.id, newVersionNumber);
                  setOpenDetailDialog(false);
                }
              }}
              startIcon={<RestoreIcon />}
            >
              恢復此版本
            </Button>
          </DialogActions>
        </Dialog>

        {/* 版本比較對話框 */}
        <Dialog 
          open={compareDialogOpen} 
          onClose={() => setCompareDialogOpen(false)}
          fullWidth
          maxWidth="md"
        >
          <DialogTitle>版本比較結果</DialogTitle>
          <DialogContent dividers>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              compareResult && (
                <>
                  <Typography variant="subtitle1" gutterBottom>
                    比較結果: {compareResult.version1?.version_number} vs {compareResult.version2?.version_number}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    差異總數: {
                      (compareResult.diff?.added?.length || 0) + 
                      (compareResult.diff?.modified?.length || 0) + 
                      (compareResult.diff?.deleted?.length || 0)
                    } 筆
                  </Typography>

                  <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>人員</TableCell>
                          <TableCell>日期</TableCell>
                          <TableCell>{compareResult.version1?.version_number}</TableCell>
                          <TableCell>{compareResult.version2?.version_number}</TableCell>
                          <TableCell>變更類型</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {/* 顯示比較結果 */}
                        {compareResult.diff?.items?.map((item, idx) => {
                          const typeInfo = getChangeTypeInfo(item.type);
                          return (
                            <TableRow key={`compare-${idx}`}>
                              <TableCell>{item.user_name || `ID: ${item.user_id}`}</TableCell>
                              <TableCell>{item.date}</TableCell>
                              <TableCell>{item.version1_value || '-'}</TableCell>
                              <TableCell>{item.version2_value || '-'}</TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  color={typeInfo.color}
                                  icon={typeInfo.icon}
                                  label={typeInfo.label}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}

                        {compareResult.diff?.items?.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} align="center">
                              <Typography variant="body2">
                                兩個版本完全相同，沒有差異
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCompareDialogOpen(false)}>關閉</Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Container>
  );
}

export default VersionHistory; 
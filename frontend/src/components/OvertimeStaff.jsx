const saveOvertimeRecords = async () => {
  setIsSaving(true);
  setErrorMessage('');
  
  try {
    const selectedGroup = selectedStaff.filter(s => s.selected);
    const userIds = selectedGroup.map(staff => staff.id);
    
    // 確保日期格式正確
    const formattedDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
    
    if (userIds.length > 0 && formattedDate) {
      // 使用更新的API參數格式
      await api.overtime.bulkUpdate({
        date: formattedDate,
        overtime_shift: selectedShift,
        user_ids: userIds
      });
      
      setSuccessMessage('加班記錄保存成功！');
      // 重新加載數據
      loadOvertimeRecords();
    }
  } catch (error) {
    console.error('保存加班記錄時出錯：', error);
    setErrorMessage(`保存失敗：${error.message || '未知錯誤'}`);
  } finally {
    setIsSaving(false);
  }
}; 
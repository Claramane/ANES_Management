import { useEffect, useState, useCallback } from 'react'
import {
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Stack,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-tw'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Tables } from '../../types/database.types'

dayjs.locale('zh-tw')

type SwapRequest = Tables<'shift_swap_requests'>
type UserProfile = Tables<'user_profiles'>

const STATUS_LABELS: Record<string, { label: string; color: 'default' | 'warning' | 'success' | 'error' | 'info' }> = {
  pending_target: { label: '等待對方同意', color: 'warning' },
  pending_admin: { label: '等待主管審核', color: 'info' },
  approved: { label: '已核准', color: 'success' },
  rejected_by_target: { label: '對方拒絕', color: 'error' },
  rejected_by_admin: { label: '主管拒絕', color: 'error' },
  invalidated: { label: '已失效', color: 'default' },
  cancelled: { label: '已取消', color: 'default' },
}

export default function SwapPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<SwapRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Form state
  const [nurses, setNurses] = useState<UserProfile[]>([])
  const [targetUserId, setTargetUserId] = useState('')
  const [requesterDate, setRequesterDate] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [memo, setMemo] = useState('')

  const loadRequests = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('shift_swap_requests')
      .select('*')
      .or(`requester_user_id.eq.${user.id},target_user_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(50)
    setRequests(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { loadRequests() }, [loadRequests])

  async function openDialog() {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, identity')
      .eq('is_active', true)
      .neq('id', user?.id ?? '')
      .order('full_name')
    setNurses(data ?? [])
    setTargetUserId('')
    setRequesterDate('')
    setTargetDate('')
    setMemo('')
    setActionError(null)
    setDialogOpen(true)
  }

  async function submitSwap() {
    if (!targetUserId || !requesterDate || !targetDate) {
      setActionError('請填寫所有必填欄位')
      return
    }
    setActionLoading(true)
    setActionError(null)
    const { error } = await supabase.rpc('submit_swap_request', {
      p_target_user_id: targetUserId,
      p_requester_date: requesterDate,
      p_target_date: targetDate,
      p_memo: memo || undefined,
    })
    setActionLoading(false)
    if (error) {
      setActionError(error.message)
    } else {
      setDialogOpen(false)
      loadRequests()
    }
  }

  async function handleDecide(id: string, decision: 'approved' | 'rejected') {
    setActionLoading(true)
    await supabase.rpc('decide_swap_request_as_target', { p_id: id, p_decision: decision })
    setActionLoading(false)
    loadRequests()
  }

  async function handleCancel(id: string) {
    setActionLoading(true)
    await supabase.rpc('cancel_swap_request', { p_id: id })
    setActionLoading(false)
    loadRequests()
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" p={2} pb={1}>
        <Typography variant="subtitle1" fontWeight={600}>換班申請</Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openDialog} sx={{ textTransform: 'none' }}>
          申請換班
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" pt={4}><CircularProgress size={32} /></Box>
      ) : requests.length === 0 ? (
        <Box p={3} textAlign="center">
          <Typography variant="body2" color="text.secondary">目前沒有換班申請記錄</Typography>
        </Box>
      ) : (
        <List disablePadding>
          {requests.map((req, idx) => {
            const isRequester = req.requester_user_id === user?.id
            const status = STATUS_LABELS[req.status] ?? { label: req.status, color: 'default' as const }
            const canDecide = !isRequester && req.status === 'pending_target'
            const canCancel = isRequester && (req.status === 'pending_target' || req.status === 'pending_admin')

            return (
              <Box key={req.id}>
                {idx > 0 && <Divider />}
                <ListItem alignItems="flex-start" sx={{ py: 1.5 }}>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                        <Typography variant="body2" fontWeight={500}>
                          {isRequester
                            ? `我的班 ${req.requester_date} (${req.requester_shift_type})`
                            : `${req.requester_full_name} 的班 ${req.requester_date} (${req.requester_shift_type})`}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">↔</Typography>
                        <Typography variant="body2" fontWeight={500}>
                          {isRequester
                            ? `${req.target_full_name} 的班 ${req.target_date} (${req.target_shift_type})`
                            : `我的班 ${req.target_date} (${req.target_shift_type})`}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                        <Chip label={status.label} color={status.color} size="small" />
                        <Typography variant="caption" color="text.secondary">
                          {dayjs(req.created_at).format('MM/DD HH:mm')}
                        </Typography>
                        {req.memo && (
                          <Typography variant="caption" color="text.secondary">備註: {req.memo}</Typography>
                        )}
                        {canDecide && (
                          <Stack direction="row" spacing={0.5} mt={0.5}>
                            <Button size="small" variant="contained" color="success" disabled={actionLoading} onClick={() => handleDecide(req.id, 'approved')} sx={{ textTransform: 'none', fontSize: 12 }}>
                              同意
                            </Button>
                            <Button size="small" variant="outlined" color="error" disabled={actionLoading} onClick={() => handleDecide(req.id, 'rejected')} sx={{ textTransform: 'none', fontSize: 12 }}>
                              拒絕
                            </Button>
                          </Stack>
                        )}
                        {canCancel && (
                          <Button size="small" variant="outlined" color="inherit" disabled={actionLoading} onClick={() => handleCancel(req.id)} sx={{ textTransform: 'none', fontSize: 12, mt: 0.5 }}>
                            取消申請
                          </Button>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              </Box>
            )
          })}
        </List>
      )}

      {/* Submit swap dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>申請換班</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {actionError && <Alert severity="error">{actionError}</Alert>}
            <TextField
              label="我的日期"
              type="date"
              value={requesterDate}
              onChange={(e) => setRequesterDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
            />
            <TextField
              select
              label="換班對象"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              fullWidth
              size="small"
            >
              {nurses.map((n) => (
                <MenuItem key={n.id} value={n.id ?? ''}>
                  {n.full_name} {n.identity ? `(${n.identity})` : ''}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="對方日期"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
            />
            <TextField
              label="備註（選填）"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              fullWidth
              size="small"
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none' }}>取消</Button>
          <Button variant="contained" onClick={submitSwap} disabled={actionLoading} sx={{ textTransform: 'none' }}>
            {actionLoading ? <CircularProgress size={16} /> : '送出申請'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

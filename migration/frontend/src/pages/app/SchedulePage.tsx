import { useEffect, useState, useMemo } from 'react'
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Chip,
  Grid,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import dayjs, { type Dayjs } from 'dayjs'
import 'dayjs/locale/zh-tw'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Tables } from '../../types/database.types'

dayjs.locale('zh-tw')

type Schedule = Tables<'monthly_schedules'>

const SHIFT_LABELS: Record<string, { label: string; color: string }> = {
  D: { label: '日', color: '#1976d2' },
  A: { label: '小夜', color: '#7b1fa2' },
  N: { label: '大夜', color: '#303f9f' },
  C: { label: '中', color: '#0288d1' },
  K: { label: '早', color: '#00796b' },
  F: { label: '晚', color: '#e65100' },
  B: { label: '日', color: '#1976d2' },
  E: { label: '半', color: '#558b2f' },
  O: { label: '休', color: '#9e9e9e' },
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export default function SchedulePage() {
  const { user } = useAuth()
  const [month, setMonth] = useState<Dayjs>(dayjs().startOf('month'))
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    const start = month.format('YYYY-MM-DD')
    const end = month.endOf('month').format('YYYY-MM-DD')
    supabase
      .from('monthly_schedules')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end)
      .then(({ data }) => {
        setSchedules(data ?? [])
        setLoading(false)
      })
  }, [user, month])

  const scheduleByDate = useMemo(() => {
    const map: Record<string, Schedule> = {}
    for (const s of schedules) map[s.date] = s
    return map
  }, [schedules])

  const days = useMemo(() => {
    const total = month.daysInMonth()
    return Array.from({ length: total }, (_, i) => month.date(i + 1))
  }, [month])

  // Leading blank cells so the grid starts on the right weekday
  const leadingBlanks = days[0]?.day() ?? 0

  return (
    <Box p={2}>
      {/* Month navigator */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <IconButton size="small" onClick={() => setMonth(m => m.subtract(1, 'month'))}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="subtitle1" fontWeight={600}>
          {month.format('YYYY年MM月')}
        </Typography>
        <IconButton size="small" onClick={() => setMonth(m => m.add(1, 'month'))}>
          <ChevronRightIcon />
        </IconButton>
      </Box>

      {/* Weekday headers */}
      <Grid container columns={7} mb={0.5}>
        {WEEKDAYS.map((d) => (
          <Grid key={d} size={1}>
            <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
              {d}
            </Typography>
          </Grid>
        ))}
      </Grid>

      {loading ? (
        <Box display="flex" justifyContent="center" pt={4}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <Grid container columns={7}>
          {/* Leading blanks */}
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <Grid key={`blank-${i}`} size={1} />
          ))}

          {days.map((day) => {
            const dateStr = day.format('YYYY-MM-DD')
            const s = scheduleByDate[dateStr]
            const shiftInfo = s ? SHIFT_LABELS[s.shift_type] : undefined
            const isToday = day.isSame(dayjs(), 'day')
            const isWeekend = day.day() === 0 || day.day() === 6

            return (
              <Grid key={dateStr} size={1}>
                <Box
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  py={0.75}
                  sx={{ minHeight: 64 }}
                >
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: isToday ? 'primary.main' : 'transparent',
                      mb: 0.5,
                    }}
                  >
                    <Typography
                      variant="caption"
                      fontWeight={isToday ? 700 : 400}
                      color={isToday ? 'primary.contrastText' : isWeekend ? 'error.main' : 'text.primary'}
                    >
                      {day.date()}
                    </Typography>
                  </Box>
                  {shiftInfo && (
                    <Chip
                      label={shiftInfo.label}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: 10,
                        bgcolor: shiftInfo.color,
                        color: '#fff',
                        '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                  )}
                </Box>
              </Grid>
            )
          })}
        </Grid>
      )}
    </Box>
  )
}

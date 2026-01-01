import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { useState } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'

interface DatePickerProps {
  visible: boolean
  selectedDate: Date
  onSelectDate: (date: Date) => void
  onClose: () => void
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export function DatePicker({
  visible,
  selectedDate,
  onSelectDate,
  onClose,
}: DatePickerProps) {
  const [viewDate, setViewDate] = useState(startOfMonth(selectedDate))

  const handlePrevMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setViewDate(subMonths(viewDate, 1))
  }

  const handleNextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setViewDate(addMonths(viewDate, 1))
  }

  const handleSelectDate = (date: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onSelectDate(date)
    onClose()
  }

  const handleToday = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const today = new Date()
    setViewDate(startOfMonth(today))
    onSelectDate(today)
    onClose()
  }

  // Generate calendar days
  const generateCalendarDays = () => {
    const days: Date[] = []
    const monthStart = startOfMonth(viewDate)
    const startDate = startOfWeek(monthStart)

    // Generate 6 weeks of days
    for (let i = 0; i < 42; i++) {
      days.push(addDays(startDate, i))
    }

    return days
  }

  const calendarDays = generateCalendarDays()

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              style={styles.navButton}
              onPress={handlePrevMonth}
              accessibilityLabel="Previous month"
              accessibilityRole="button"
            >
              <Text style={styles.navButtonText}>{'<'}</Text>
            </Pressable>
            <Text style={styles.monthYear} accessibilityRole="header">
              {format(viewDate, 'MMMM yyyy').toUpperCase()}
            </Text>
            <Pressable
              style={styles.navButton}
              onPress={handleNextMonth}
              accessibilityLabel="Next month"
              accessibilityRole="button"
            >
              <Text style={styles.navButtonText}>{'>'}</Text>
            </Pressable>
          </View>

          {/* Weekday headers */}
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((day) => (
              <View key={day} style={styles.weekdayCell}>
                <Text style={styles.weekdayText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.calendarGrid}>
            {calendarDays.map((date, index) => {
              const isCurrentMonth = isSameMonth(date, viewDate)
              const isSelected = isSameDay(date, selectedDate)
              const isTodayDate = isToday(date)

              return (
                <Pressable
                  key={index}
                  style={[
                    styles.dayCell,
                    !isCurrentMonth && styles.dayCellOutside,
                    isSelected && styles.dayCellSelected,
                    isTodayDate && !isSelected && styles.dayCellToday,
                  ]}
                  onPress={() => handleSelectDate(date)}
                  accessibilityLabel={`${format(date, 'EEEE, MMMM d, yyyy')}${isSelected ? ', selected' : ''}${isTodayDate ? ', today' : ''}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text
                    style={[
                      styles.dayText,
                      !isCurrentMonth && styles.dayTextOutside,
                      isSelected && styles.dayTextSelected,
                      isTodayDate && !isSelected && styles.dayTextToday,
                    ]}
                  >
                    {format(date, 'd')}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable
              style={styles.todayButton}
              onPress={handleToday}
              accessibilityLabel="Select today's date"
              accessibilityRole="button"
            >
              <Text style={styles.todayButtonText}>TODAY</Text>
            </Pressable>
            <Pressable
              style={styles.closeButton}
              onPress={onClose}
              accessibilityLabel="Close date picker"
              accessibilityRole="button"
            >
              <Text style={styles.closeButtonText}>CLOSE</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    width: '100%',
    maxWidth: 360,
    ...NeoShadow.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
    backgroundColor: Neo.yellow,
  },
  navButton: {
    width: 40,
    height: 40,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
  },
  monthYear: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  weekdayRow: {
    flexDirection: 'row',
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
  },
  weekdayCell: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 10,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayCellOutside: {
    opacity: 0.3,
  },
  dayCellSelected: {
    backgroundColor: Neo.lime,
    borderColor: Neo.black,
    borderWidth: NeoBorder.thin,
  },
  dayCellToday: {
    backgroundColor: Neo.cyan,
    borderColor: Neo.black,
    borderWidth: NeoBorder.thin,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dayTextOutside: {
    color: Neo.black,
  },
  dayTextSelected: {
    color: Neo.black,
    fontWeight: '900',
  },
  dayTextToday: {
    color: Neo.black,
    fontWeight: '900',
  },
  footer: {
    flexDirection: 'row',
    borderTopWidth: NeoBorder.default,
    borderTopColor: Neo.black,
  },
  todayButton: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    backgroundColor: Neo.lime,
    borderRightWidth: NeoBorder.thin,
    borderRightColor: Neo.black,
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  closeButton: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    backgroundColor: Neo.white,
  },
  closeButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})

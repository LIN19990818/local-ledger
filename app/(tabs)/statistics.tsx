import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { useAppStore } from '../../src/store';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../../src/theme/colors';
import { formatCurrency, formatDate, calculatePercentage, getDateRange } from '../../src/utils/helpers';
import { TransactionRepository } from '../../src/database/repository';
import { format, subMonths, subYears, startOfMonth, endOfMonth } from 'date-fns';

const screenWidth = Dimensions.get('window').width;

type TimeRange = 'day' | 'week' | 'month' | 'year';
type ChartType = 'line' | 'bar' | 'pie';

export default function StatisticsScreen() {
  const { account, budget, transactions } = useAppStore();
  
  const [timeRange, setTimeRange] = useState<TimeRange>('day');
  const [chartType, setChartType] = useState<ChartType>('pie');
  const [stats, setStats] = useState({ income: 0, expense: 0, net: 0 });
  const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);
  const [yearlyData, setYearlyData] = useState<any>(null);

  useEffect(() => {
    loadStatistics();
  }, [timeRange, transactions]);

  const loadStatistics = async () => {
    const { start, end } = getDateRange(timeRange);
    
    if (timeRange === 'year') {
      const year = new Date().getFullYear();
      const [yearStats, trend, breakdown] = await Promise.all([
        TransactionRepository.getYearlyStats(year),
        TransactionRepository.getMonthlyTrend(year),
        TransactionRepository.getCategoryBreakdown(
          new Date(year, 0, 1).getTime(),
          new Date(year, 11, 31, 23, 59, 59, 999).getTime(),
          'expense'
        )
      ]);
      
      setStats(yearStats);
      setMonthlyTrend(trend);
      setCategoryBreakdown(breakdown);
      
      const topCategory = breakdown.length > 0 ? {
        name: breakdown[0].categoryName,
        amount: breakdown[0].amount,
        percentage: calculatePercentage(breakdown[0].amount, yearStats.expense)
      } : null;
      
      setYearlyData({ topCategory });
    } else {
      const [periodStats, breakdown] = await Promise.all([
        timeRange === 'day' 
          ? TransactionRepository.getDailyStats(Date.now())
          : timeRange === 'week'
          ? TransactionRepository.getMonthlyStats(format(new Date(), 'yyyy-MM'))
          : TransactionRepository.getMonthlyStats(format(new Date(), 'yyyy-MM')),
        TransactionRepository.getCategoryBreakdown(start, end, 'expense')
      ]);
      
      setStats(periodStats);
      setCategoryBreakdown(breakdown);
    }
  };

  const chartConfig = {
    backgroundColor: colors.background.light,
    backgroundGradientFrom: colors.background.light,
    backgroundGradientTo: colors.background.light,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(15, 23, 42, ${opacity})`,
    style: {
      borderRadius: borderRadius.lg
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: colors.primary
    }
  };

  const pieColors = [
    '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ];

  const pieData = categoryBreakdown.slice(0, 10).map((item, index) => ({
    name: item.categoryName,
    amount: item.amount,
    color: pieColors[index % pieColors.length],
    legendFontColor: colors.text.primary.light,
    legendFontSize: 12
  }));

  const lineData = {
    labels: monthlyTrend.slice(-6).map(m => format(new Date(m.month), 'M月')),
    datasets: [
      {
        data: monthlyTrend.slice(-6).map(m => m.income),
        color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
        strokeWidth: 2
      },
      {
        data: monthlyTrend.slice(-6).map(m => m.expense),
        color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
        strokeWidth: 2
      }
    ]
  };

  const barData = {
    labels: monthlyTrend.slice(-6).map(m => format(new Date(m.month), 'M月')),
    datasets: [
      {
        data: monthlyTrend.slice(-6).map(m => m.income),
        color: (opacity = 1) => colors.success
      },
      {
        data: monthlyTrend.slice(-6).map(m => m.expense),
        color: (opacity = 1) => colors.danger
      }
    ]
  };

  const renderTimeRangeSelector = () => (
    <View style={styles.timeRangeSelector}>
      {(['day', 'week', 'month', 'year'] as TimeRange[]).map(range => (
        <TouchableOpacity
          key={range}
          style={[
            styles.timeRangeButton,
            timeRange === range && styles.timeRangeButtonActive
          ]}
          onPress={() => setTimeRange(range)}
        >
          <Text style={[
            styles.timeRangeText,
            timeRange === range && styles.timeRangeTextActive
          ]}>
            {range === 'day' ? '今日' : range === 'week' ? '本周' : range === 'month' ? '本月' : '本年'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSummaryCards = () => (
    <View style={styles.summaryContainer}>
      <View style={[styles.summaryCard, styles.incomeCard]}>
        <Ionicons name="trending-up" size={24} color={colors.success} />
        <Text style={styles.summaryLabel}>总收入</Text>
        <Text style={[styles.summaryValue, { color: colors.success }]}>
          {formatCurrency(stats.income)}
        </Text>
      </View>
      
      <View style={[styles.summaryCard, styles.expenseCard]}>
        <Ionicons name="trending-down" size={24} color={colors.danger} />
        <Text style={styles.summaryLabel}>总支出</Text>
        <Text style={[styles.summaryValue, { color: colors.danger }]}>
          {formatCurrency(stats.expense)}
        </Text>
      </View>
      
      <View style={[styles.summaryCard, styles.netCard]}>
        <Ionicons 
          name={stats.net >= 0 ? 'happy' : 'sad'} 
          size={24} 
          color={stats.net >= 0 ? colors.success : colors.danger} 
        />
        <Text style={styles.summaryLabel}>净收支</Text>
        <Text style={[styles.summaryValue, { color: stats.net >= 0 ? colors.success : colors.danger }]}>
          {stats.net >= 0 ? '+' : ''}{formatCurrency(stats.net)}
        </Text>
      </View>
    </View>
  );

  const renderChartTypeSelector = () => (
    <View style={styles.chartTypeSelector}>
      {(['pie', 'line', 'bar'] as ChartType[]).map(type => (
        <TouchableOpacity
          key={type}
          style={[
            styles.chartTypeButton,
            chartType === type && styles.chartTypeButtonActive
          ]}
          onPress={() => setChartType(type)}
        >
          <Ionicons
            name={type === 'pie' ? 'pie-chart' : type === 'line' ? 'analytics' : 'bar-chart'}
            size={20}
            color={chartType === type ? colors.primary : colors.text.secondary.light}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderChart = () => {
    if (categoryBreakdown.length === 0) {
      return (
        <View style={styles.emptyChart}>
          <Ionicons name="bar-chart-outline" size={48} color={colors.text.secondary.light} />
          <Text style={styles.emptyText}>暂无数据</Text>
        </View>
      );
    }

    if (chartType === 'pie') {
      return (
        <PieChart
          data={pieData}
          width={screenWidth - spacing.md * 2}
          height={220}
          chartConfig={chartConfig}
          accessor="amount"
          backgroundColor="transparent"
          paddingLeft="15"
          absolute
        />
      );
    }

    if (chartType === 'line') {
      return (
        <LineChart
          data={lineData}
          width={screenWidth - spacing.md * 2}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
      );
    }

    return (
      <BarChart
        data={{
          labels: barData.labels,
          datasets: [{ data: barData.datasets[0].data }]
        }}
        width={screenWidth - spacing.md * 2}
        height={220}
        chartConfig={chartConfig}
        style={styles.chart}
        yAxisLabel="¥"
        yAxisSuffix=""
        showValuesOnTopOfBars
      />
    );
  };

  const renderCategoryBreakdown = () => (
    <View style={styles.categorySection}>
      <Text style={styles.sectionTitle}>分类明细</Text>
      {categoryBreakdown.slice(0, 8).map((item, index) => (
        <TouchableOpacity key={item.categoryId} style={styles.categoryItem}>
          <View style={styles.categoryLeft}>
            <Text style={styles.categoryIcon}>{item.categoryIcon}</Text>
            <View>
              <Text style={styles.categoryName}>{item.categoryName}</Text>
              <Text style={styles.categoryCount}>{item.count}笔</Text>
            </View>
          </View>
          <View style={styles.categoryRight}>
            <Text style={styles.categoryAmount}>{formatCurrency(item.amount)}</Text>
            <View style={styles.categoryBar}>
              <View 
                style={[
                  styles.categoryBarFill, 
                  { 
                    width: `${calculatePercentage(item.amount, stats.expense)}%`,
                    backgroundColor: pieColors[index % pieColors.length]
                  }
                ]} 
              />
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderYearlySummary = () => {
    if (timeRange !== 'year' || !yearlyData) return null;
    
    return (
      <View style={styles.yearlySummary}>
        <Text style={styles.sectionTitle}>年度总结</Text>
        <View style={styles.yearlyCard}>
          <Ionicons name="trophy" size={32} color={colors.warning} />
          <Text style={styles.yearlyTitle}>最大支出类别</Text>
          {yearlyData.topCategory ? (
            <>
              <Text style={styles.yearlyValue}>{yearlyData.topCategory.name}</Text>
              <Text style={styles.yearlyDetail}>
                支出 {formatCurrency(yearlyData.topCategory.amount)}，
                占总支出的 {yearlyData.topCategory.percentage}%
              </Text>
            </>
          ) : (
            <Text style={styles.yearlyValue}>暂无数据</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderTimeRangeSelector()}
        {renderSummaryCards()}
        
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <Text style={styles.sectionTitle}>收支分析</Text>
            {renderChartTypeSelector()}
          </View>
          {renderChart()}
        </View>
        
        {renderCategoryBreakdown()}
        {renderYearlySummary()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.light
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: spacing.md
  },
  timeRangeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    marginBottom: spacing.md
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md
  },
  timeRangeButtonActive: {
    backgroundColor: colors.primary
  },
  timeRangeText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary.light,
    fontWeight: fontWeight.medium
  },
  timeRangeTextActive: {
    color: '#FFFFFF'
  },
  summaryContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.card.light,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm
  },
  incomeCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.success
  },
  expenseCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.danger
  },
  netCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary.light,
    marginTop: spacing.xs
  },
  summaryValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginTop: spacing.xs
  },
  chartSection: {
    backgroundColor: colors.card.light,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary.light
  },
  chartTypeSelector: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  chartTypeButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.light
  },
  chartTypeButtonActive: {
    backgroundColor: colors.primaryLight + '20'
  },
  chart: {
    borderRadius: borderRadius.lg
  },
  emptyChart: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.text.secondary.light,
    marginTop: spacing.sm
  },
  categorySection: {
    backgroundColor: colors.card.light,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  categoryIcon: {
    fontSize: 24,
    marginRight: spacing.sm
  },
  categoryName: {
    fontSize: fontSize.md,
    color: colors.text.primary.light,
    fontWeight: fontWeight.medium
  },
  categoryCount: {
    fontSize: fontSize.xs,
    color: colors.text.secondary.light
  },
  categoryRight: {
    alignItems: 'flex-end'
  },
  categoryAmount: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary.light
  },
  categoryBar: {
    width: 80,
    height: 4,
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
    overflow: 'hidden'
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: borderRadius.full
  },
  yearlySummary: {
    marginBottom: spacing.lg
  },
  yearlyCard: {
    backgroundColor: colors.card.light,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.sm
  },
  yearlyTitle: {
    fontSize: fontSize.md,
    color: colors.text.secondary.light,
    marginTop: spacing.sm
  },
  yearlyValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary.light,
    marginTop: spacing.xs
  },
  yearlyDetail: {
    fontSize: fontSize.sm,
    color: colors.text.secondary.light,
    marginTop: spacing.xs,
    textAlign: 'center'
  }
});

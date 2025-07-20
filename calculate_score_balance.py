#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
加班分數平衡計算 - 基於實際班表模型
目標：長期多月排班後，每個人的分數在0分附近震盪
"""

import datetime
import calendar
from typing import Dict, List
from dataclasses import dataclass

@dataclass
class ScoreSystem:
    a_score: float
    b_score: float
    c_score: float
    d_score: float
    e_score: float = 0.0
    f_score: float = 0.0
    no_overtime_penalty: float = 0.0  # 白班未加班的負分

def analyze_annual_workload():
    """分析年度工作負荷"""
    print("=== 年度工作負荷分析 ===")
    
    year = 2025
    total_work_days = 0
    total_weekdays = 0  # 週一至週五
    total_saturdays = 0
    total_sundays = 0
    
    for month in range(1, 13):
        days_in_month = calendar.monthrange(year, month)[1]
        
        month_work_days = 0
        month_weekdays = 0
        month_saturdays = 0
        month_sundays = 0
        
        for day in range(1, days_in_month + 1):
            date = datetime.date(year, month, day)
            weekday = date.weekday()  # 0=週一, 6=週日
            
            if weekday == 6:  # 週日
                month_sundays += 1
            elif weekday == 5:  # 週六
                month_saturdays += 1
                month_work_days += 1
            else:  # 週一至週五
                month_weekdays += 1
                month_work_days += 1
        
        total_work_days += month_work_days
        total_weekdays += month_weekdays
        total_saturdays += month_saturdays
        total_sundays += month_sundays
        
        print(f"{month:2d}月: 工作日{month_work_days:2d}天 (平日{month_weekdays:2d}, 週六{month_saturdays:1d}, 週日{month_sundays:2d})")
    
    print(f"\n年度總計:")
    print(f"總工作日: {total_work_days}天")
    print(f"平日: {total_weekdays}天")
    print(f"週六: {total_saturdays}天")
    print(f"週日: {total_sundays}天")
    
    return {
        'total_work_days': total_work_days,
        'weekdays': total_weekdays,
        'saturdays': total_saturdays,
        'sundays': total_sundays
    }

def calculate_overtime_demand(workload: Dict) -> Dict:
    """計算加班需求"""
    print("\n=== 加班需求分析 ===")
    
    # 平日：每天6人加班 (A, B, C, D, E, F)
    weekday_overtime_slots = workload['weekdays'] * 6
    weekday_a_shifts = workload['weekdays']
    weekday_other_shifts = workload['weekdays'] * 5  # B, C, D, E, F
    
    # 週六：每天1人加班 (僅A班)
    saturday_overtime_slots = workload['saturdays'] * 1
    saturday_a_shifts = workload['saturdays']
    
    # 總計
    total_overtime_slots = weekday_overtime_slots + saturday_overtime_slots
    total_a_shifts = weekday_a_shifts + saturday_a_shifts
    total_other_shifts = weekday_other_shifts
    
    print(f"平日加班需求: {workload['weekdays']}天 × 6人 = {weekday_overtime_slots}人次")
    print(f"週六加班需求: {workload['saturdays']}天 × 1人 = {saturday_overtime_slots}人次")
    print(f"總加班需求: {total_overtime_slots}人次")
    print(f"")
    print(f"A班總需求: {total_a_shifts}次")
    print(f"B班需求: {workload['weekdays']}次")
    print(f"C班需求: {workload['weekdays']}次") 
    print(f"D班需求: {workload['weekdays']}次")
    print(f"E班需求: {workload['weekdays']}次")
    print(f"F班需求: {workload['weekdays']}次")
    
    return {
        'total_slots': total_overtime_slots,
        'a_shifts': total_a_shifts,
        'b_shifts': workload['weekdays'],
        'c_shifts': workload['weekdays'],
        'd_shifts': workload['weekdays'],
        'e_shifts': workload['weekdays'],
        'f_shifts': workload['weekdays']
    }

def calculate_individual_expectations(workload: Dict, overtime_demand: Dict, num_staff: int = 27) -> Dict:
    """計算個人年度期望值"""
    print(f"\n=== 個人年度期望分析 (假設{num_staff}人) ===")
    
    # 每人年度期望加班次數
    total_overtime_slots = overtime_demand['total_slots']
    avg_overtime_per_person = total_overtime_slots / num_staff
    
    # 每人年度期望各班別次數
    avg_a_per_person = overtime_demand['a_shifts'] / num_staff
    avg_b_per_person = overtime_demand['b_shifts'] / num_staff
    avg_c_per_person = overtime_demand['c_shifts'] / num_staff
    avg_d_per_person = overtime_demand['d_shifts'] / num_staff
    avg_e_per_person = overtime_demand['e_shifts'] / num_staff
    avg_f_per_person = overtime_demand['f_shifts'] / num_staff
    
    # 每人年度期望白班天數（假設平均出勤率90%）
    avg_white_shifts_per_person = workload['total_work_days'] * 0.9
    
    # 每人年度未加班白班天數
    avg_no_overtime_white_shifts = avg_white_shifts_per_person - avg_overtime_per_person
    
    print(f"平均每人年度加班: {avg_overtime_per_person:.1f}次")
    print(f"平均每人年度白班: {avg_white_shifts_per_person:.1f}天")
    print(f"平均每人未加班白班: {avg_no_overtime_white_shifts:.1f}天")
    print(f"")
    print(f"平均每人各班別期望:")
    print(f"  A班: {avg_a_per_person:.1f}次")
    print(f"  B班: {avg_b_per_person:.1f}次")
    print(f"  C班: {avg_c_per_person:.1f}次")
    print(f"  D班: {avg_d_per_person:.1f}次")
    print(f"  E班: {avg_e_per_person:.1f}次")
    print(f"  F班: {avg_f_per_person:.1f}次")
    
    return {
        'avg_overtime_total': avg_overtime_per_person,
        'avg_white_shifts': avg_white_shifts_per_person,
        'avg_no_overtime_white': avg_no_overtime_white_shifts,
        'avg_a': avg_a_per_person,
        'avg_b': avg_b_per_person,
        'avg_c': avg_c_per_person,
        'avg_d': avg_d_per_person,
        'avg_e': avg_e_per_person,
        'avg_f': avg_f_per_person
    }

def design_score_system(expectations: Dict) -> ScoreSystem:
    """設計分數系統，目標零分平衡"""
    print(f"\n=== 分數系統設計 ===")
    
    # 設計約束：
    # 1. A班分數 ≈ B班分數 × 2
    # 2. E, F班分數 = 0
    # 3. 年度期望總分 = 0
    
    # 設置相對分數比例
    # 假設 A=2x, B=x, C=0.8x, D=0.3x, E=0, F=0
    # 未加班白班 = -y
    
    avg_a = expectations['avg_a']
    avg_b = expectations['avg_b'] 
    avg_c = expectations['avg_c']
    avg_d = expectations['avg_d']
    avg_no_overtime = expectations['avg_no_overtime_white']
    
    print(f"設計目標：")
    print(f"1. A班 ≈ B班 × 2")
    print(f"2. E、F班 = 0分")
    print(f"3. 年度期望總分 = 0分")
    print(f"")
    
    # 設定分數系統
    # 假設B班 = 1.0分，則A班 = 2.0分
    # 為了達到零分平衡，計算未加班負分
    
    # 嘗試不同的分數組合
    for b_score in [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]:
        a_score = b_score * 2.0
        c_score = b_score * 0.8
        d_score = b_score * 0.3
        e_score = 0.0
        f_score = 0.0
        
        # 計算正分總和
        positive_score = (
            avg_a * a_score +
            avg_b * b_score +
            avg_c * c_score +
            avg_d * d_score +
            avg_no_overtime * e_score +  # E班次數
            expectations['avg_f'] * f_score
        )
        
        # 計算所需的負分來平衡
        required_negative_score = -positive_score
        no_overtime_penalty = required_negative_score / avg_no_overtime
        
        print(f"方案 B={b_score:.1f}: A={a_score:.1f}, C={c_score:.1f}, D={d_score:.1f}, 負分={no_overtime_penalty:.3f}")
        print(f"  正分總和: {positive_score:.2f}")
        print(f"  所需負分: {required_negative_score:.2f}")
        print(f"  未加班負分: {no_overtime_penalty:.3f}")
        
        # 檢查負分是否合理（一般在-0.1到-0.5之間比較合理）
        if -0.5 <= no_overtime_penalty <= -0.1:
            print(f"  ✅ 此方案負分合理")
            recommended_system = ScoreSystem(
                a_score=a_score,
                b_score=b_score,
                c_score=c_score,
                d_score=d_score,
                e_score=e_score,
                f_score=f_score,
                no_overtime_penalty=no_overtime_penalty
            )
        else:
            print(f"  ❌ 負分過高或過低")
        print()
    
    return recommended_system

def verify_score_system(score_system: ScoreSystem, expectations: Dict):
    """驗證分數系統的平衡性"""
    print(f"\n=== 分數系統驗證 ===")
    
    print(f"推薦分數系統:")
    print(f"  A班: {score_system.a_score:.1f}分")
    print(f"  B班: {score_system.b_score:.1f}分") 
    print(f"  C班: {score_system.c_score:.1f}分")
    print(f"  D班: {score_system.d_score:.1f}分")
    print(f"  E班: {score_system.e_score:.1f}分")
    print(f"  F班: {score_system.f_score:.1f}分")
    print(f"  未加班: {score_system.no_overtime_penalty:.3f}分")
    print(f"")
    
    # 計算期望年度總分
    expected_annual_score = (
        expectations['avg_a'] * score_system.a_score +
        expectations['avg_b'] * score_system.b_score +
        expectations['avg_c'] * score_system.c_score +
        expectations['avg_d'] * score_system.d_score +
        expectations['avg_e'] * score_system.e_score +
        expectations['avg_f'] * score_system.f_score +
        expectations['avg_no_overtime_white'] * score_system.no_overtime_penalty
    )
    
    print(f"期望年度總分驗證:")
    print(f"  A班貢獻: {expectations['avg_a']:.1f} × {score_system.a_score:.1f} = {expectations['avg_a'] * score_system.a_score:.2f}")
    print(f"  B班貢獻: {expectations['avg_b']:.1f} × {score_system.b_score:.1f} = {expectations['avg_b'] * score_system.b_score:.2f}")
    print(f"  C班貢獻: {expectations['avg_c']:.1f} × {score_system.c_score:.1f} = {expectations['avg_c'] * score_system.c_score:.2f}")
    print(f"  D班貢獻: {expectations['avg_d']:.1f} × {score_system.d_score:.1f} = {expectations['avg_d'] * score_system.d_score:.2f}")
    print(f"  E班貢獻: {expectations['avg_e']:.1f} × {score_system.e_score:.1f} = {expectations['avg_e'] * score_system.e_score:.2f}")
    print(f"  F班貢獻: {expectations['avg_f']:.1f} × {score_system.f_score:.1f} = {expectations['avg_f'] * score_system.f_score:.2f}")
    print(f"  負分貢獻: {expectations['avg_no_overtime_white']:.1f} × {score_system.no_overtime_penalty:.3f} = {expectations['avg_no_overtime_white'] * score_system.no_overtime_penalty:.2f}")
    print(f"  總分: {expected_annual_score:.3f}分")
    
    if abs(expected_annual_score) < 0.1:
        print(f"  ✅ 分數系統平衡良好")
    else:
        print(f"  ❌ 分數系統需要調整")

def simulate_different_scenarios(score_system: ScoreSystem):
    """模擬不同出勤情況下的分數"""
    print(f"\n=== 不同情況模擬 ===")
    
    # 基準：年度260個工作日，平均出勤90%
    base_work_days = 260
    base_attendance = 0.9
    base_white_days = base_work_days * base_attendance
    
    scenarios = [
        ("正常出勤(90%)", base_attendance, 10, 10, 8, 8, 8, 8),
        ("高出勤(95%)", 0.95, 12, 11, 9, 9, 9, 9),
        ("低出勤(80%)", 0.80, 8, 8, 7, 7, 7, 7),
        ("夜班人員(50%白班)", 0.50, 5, 5, 4, 4, 4, 4),
        ("長期請假(30%)", 0.30, 3, 3, 2, 2, 2, 2),
    ]
    
    print(f"分數系統: A={score_system.a_score:.1f}, B={score_system.b_score:.1f}, C={score_system.c_score:.1f}, D={score_system.d_score:.1f}, 未加班={score_system.no_overtime_penalty:.3f}")
    print(f"")
    
    for scenario_name, attendance_rate, a_count, b_count, c_count, d_count, e_count, f_count in scenarios:
        white_days = base_work_days * attendance_rate
        overtime_days = a_count + b_count + c_count + d_count + e_count + f_count
        no_overtime_days = white_days - overtime_days
        
        total_score = (
            a_count * score_system.a_score +
            b_count * score_system.b_score +
            c_count * score_system.c_score +
            d_count * score_system.d_score +
            e_count * score_system.e_score +
            f_count * score_system.f_score +
            no_overtime_days * score_system.no_overtime_penalty
        )
        
        print(f"{scenario_name:15s}: 白班{white_days:5.0f}天, 加班{overtime_days:2d}次, 未加班{no_overtime_days:5.0f}天 → 總分{total_score:6.1f}")

def main():
    """主分析函數"""
    print("基於實際班表模型的加班分數平衡分析")
    print("目標：設計分數系統使多月排班後個人分數在0分附近震盪")
    print("=" * 60)
    
    # 1. 分析年度工作負荷
    workload = analyze_annual_workload()
    
    # 2. 計算加班需求
    overtime_demand = calculate_overtime_demand(workload)
    
    # 3. 計算個人期望值
    expectations = calculate_individual_expectations(workload, overtime_demand)
    
    # 4. 設計分數系統
    score_system = design_score_system(expectations)
    
    # 5. 驗證分數系統
    verify_score_system(score_system, expectations)
    
    # 6. 模擬不同情況
    simulate_different_scenarios(score_system)
    
    print(f"\n=== 最終建議 ===")
    print(f"推薦分數系統:")
    print(f"  A班: {score_system.a_score:.1f}分")
    print(f"  B班: {score_system.b_score:.1f}分")
    print(f"  C班: {score_system.c_score:.1f}分") 
    print(f"  D班: {score_system.d_score:.1f}分")
    print(f"  E班: {score_system.e_score:.1f}分")
    print(f"  F班: {score_system.f_score:.1f}分")
    print(f"  未加班白班: {score_system.no_overtime_penalty:.3f}分")
    print(f"")
    print(f"特性:")
    print(f"  - A班價值約為B班的2倍")
    print(f"  - E、F班為0分") 
    print(f"  - 長期多月排班後期望總分為0分")
    print(f"  - 適應不同出勤率和加班頻率")

if __name__ == "__main__":
    main()
import pytest
from main import calculate_risk_score

def test_risk_scorer_all_zero():
    """1. All three detectors return 0 confidence/0 matches -> score should be 0"""
    score = calculate_risk_score(0.0, 0.0, 0)
    assert score == 0

def test_risk_scorer_only_injection():
    """2. Only injection triggers at confidence 1.0 -> score should be exactly 40"""
    score = calculate_risk_score(1.0, 0.0, 0)
    assert score == 40

def test_risk_scorer_only_jailbreak():
    """3. Only jailbreak triggers at confidence 1.0 -> score should be exactly 35"""
    score = calculate_risk_score(0.0, 1.0, 0)
    assert score == 35

def test_risk_scorer_pii_cap():
    """4. Only PII triggers with match_count=5 (above the cap of 3) -> score should be capped correctly at 25, not 41.67"""
    score = calculate_risk_score(0.0, 0.0, 5)
    assert score == 25

def test_risk_scorer_max_cap():
    """5. All three trigger at max simultaneously -> score should cap at 100, not overflow"""
    # 40*1.0 + 35*1.0 + 25*3 = 40 + 35 + 75 = 150 -> Cap at 100
    score = calculate_risk_score(1.0, 1.0, 3)
    assert score == 100

def test_risk_scorer_threshold_boundary():
    """6. A combination that lands exactly on the 40-threshold boundary"""
    # Let's get exactly 40. Injection=0, Jailbreak=0, PII=1 -> 25 (not 40)
    # Injection=1.0 -> 40. Let's do Injection=0.5 (20) + Jailbreak=0 (0) + PII=0 -> 20.
    # To hit exactly 40: Injection = 1.0 (40), jb=0, pii=0
    score = calculate_risk_score(1.0, 0.0, 0)
    assert score == 40
    # The decision logic is `allowed = risk_score < app_threshold`.
    # If threshold is 40, risk_score 40 is NOT allowed. (40 < 40 is False).

def test_risk_scorer_integer_return():
    """7. Verify the score is always returned as an integer, never a float"""
    score = calculate_risk_score(0.99, 0.99, 1)
    assert isinstance(score, int)

def pytest_terminal_summary(terminalreporter, exitstatus, config):
    terminalreporter.write_sep("=", "Risk Scorer Table (Input vs Actual)")
    terminalreporter.write_line(f"{'Inj':<5} | {'JB':<5} | {'PII':<5} | {'Expected':<10} | {'Actual':<10}")
    terminalreporter.write_line("-" * 45)
    
    cases = [
        (0.0, 0.0, 0, 0),
        (1.0, 0.0, 0, 40),
        (0.0, 1.0, 0, 35),
        (0.0, 0.0, 5, 25),
        (1.0, 1.0, 3, 100),
    ]
    for inj, jb, pii, expected in cases:
        actual = calculate_risk_score(inj, jb, pii)
        terminalreporter.write_line(f"{inj:<5} | {jb:<5} | {pii:<5} | {expected:<10} | {actual:<10}")
    terminalreporter.write_sep("=", "End of Risk Scorer Table")

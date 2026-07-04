import pytest
from detectors.pii import detect_pii

def test_pii_individual_types():
    # Email
    res = detect_pii("Contact me at john.doe@example.com")
    assert "EMAIL" in res["matched_types"]
    assert res["is_pii_leak"] is True
    
    # Phone (Indian)
    res = detect_pii("My number is 9876543210")
    assert "PHONE" in res["matched_types"]
    assert res["is_pii_leak"] is True

    # Phone (International)
    res = detect_pii("Call +44 20 7123 1234")
    assert "PHONE" in res["matched_types"]
    assert res["is_pii_leak"] is True

    # Credit Card
    res = detect_pii("My card is 4111-1111-1111-1111")
    assert "CREDIT_CARD" in res["matched_types"]
    assert res["is_pii_leak"] is True


def test_pii_multiple_types():
    res = detect_pii("Email john@example.com or call 9876543210 with card 4111 1111 1111 1111")
    assert res["match_count"] >= 3
    assert "EMAIL" in res["matched_types"]
    assert "PHONE" in res["matched_types"]
    assert "CREDIT_CARD" in res["matched_types"]
    assert res["is_pii_leak"] is True


def test_pii_spacy_ner():
    # Person
    res = detect_pii("My name is John Smith and I need help.")
    assert "PERSON" in res["matched_types"]

    # Location (GPE)
    res = detect_pii("I am traveling to Paris tomorrow.")
    assert "GPE" in res["matched_types"]

    # Organization (ORG)
    res = detect_pii("I work for Microsoft Corporation.")
    assert "ORG" in res["matched_types"]


def test_pii_false_positive_resistance():
    benign_texts = [
        "The product SKU is 84729102",  # 8 digits (not 10, not 16)
        "We are planning for the year 2026",
        "The price is ₹4999",
        "Can you add 12 to 45?"
    ]
    for text in benign_texts:
        res = detect_pii(text)
        assert "PHONE" not in res["matched_types"], f"False positive PHONE on: {text}"
        assert "CREDIT_CARD" not in res["matched_types"], f"False positive CREDIT_CARD on: {text}"


def test_pii_mixed_case_benign_company():
    # A benign message that happens to mention a real company name
    text = "Does your software integrate with Google?"
    res = detect_pii(text)
    
    # Documenting: This flags 'Google' as an ORG. In a customer support context, 
    # this is a false positive that may require tuning (e.g., an allowlist of known tech companies).
    assert "ORG" in res["matched_types"], "Google should be detected as ORG by spaCy"
    assert res["is_pii_leak"] is True


def pytest_terminal_summary(terminalreporter, exitstatus, config):
    # Print a summary table of pass/fail per case
    terminalreporter.write_sep("=", "PII Test Case Summary Table")
    terminalreporter.write_line(f"{'Test Case':<50} | {'Status':<10}")
    terminalreporter.write_line("-" * 65)
    for rep in terminalreporter.stats.get('passed', []):
        terminalreporter.write_line(f"{rep.nodeid:<50} | {'PASS':<10}")
    for rep in terminalreporter.stats.get('failed', []):
        terminalreporter.write_line(f"{rep.nodeid:<50} | {'FAIL':<10}")
    terminalreporter.write_sep("=", "End of PII Summary")

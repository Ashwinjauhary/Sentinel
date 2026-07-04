import re
import spacy

# Load spaCy model. In a real app, this should be loaded once globally.
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    import spacy.cli
    spacy.cli.download("en_core_web_sm")
    nlp = spacy.load("en_core_web_sm")

def detect_pii(text: str) -> dict:
    match_count = 0
    matched_types = set()

    # 1. Regex checks
    # Email
    email_pattern = r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+'
    emails = re.findall(email_pattern, text)
    if emails:
        match_count += len(emails)
        matched_types.add("EMAIL")

    # Phone numbers (Indian 10-digit and international)
    phone_pattern = r'(?:\+?91[\-\s]?)?[789]\d{9}|\+(?:[0-9] ?){6,14}[0-9]'
    phones = re.findall(phone_pattern, text)
    if phones:
        match_count += len(phones)
        matched_types.add("PHONE")

    # Credit card (basic 16 digit pattern, optionally separated by dash/space)
    cc_pattern = r'\b(?:\d[ -]*?){13,16}\b'
    ccs = re.findall(cc_pattern, text)
    if ccs:
        match_count += len(ccs)
        matched_types.add("CREDIT_CARD")

    # 2. spaCy NER
    doc = nlp(text)
    for ent in doc.ents:
        if ent.label_ in ["PERSON", "GPE", "ORG"]:
            match_count += 1
            matched_types.add(ent.label_)

    is_pii_leak = match_count > 0
    
    return {
        "is_pii_leak": is_pii_leak,
        "match_count": match_count,
        "matched_types": list(matched_types)
    }

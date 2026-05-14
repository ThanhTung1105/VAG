"""Shared date parsing utility."""
from datetime import datetime


def parse_date(s):
    """Parse various date string formats into datetime."""
    if not s:
        return None
    s = str(s).strip()
    # Try ISO format: 2026-05-01T08:30, 2026-05-01T08:30:00, 2026-05-01T08:30+07:00
    try:
        return datetime.fromisoformat(s.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        pass
    # yyyy-mm-dd
    try:
        return datetime.strptime(s, '%Y-%m-%d')
    except (ValueError, AttributeError):
        pass
    # yyyy-mm-ddTHH:MM
    try:
        return datetime.strptime(s, '%Y-%m-%dT%H:%M')
    except (ValueError, AttributeError):
        pass
    # dd/mm/yyyy
    try:
        return datetime.strptime(s, '%d/%m/%Y')
    except (ValueError, AttributeError):
        pass
    # dd/mm/yyyy HH:MM
    try:
        return datetime.strptime(s, '%d/%m/%Y %H:%M')
    except (ValueError, AttributeError):
        pass
    return None


# ── Vietnam timezone (UTC+7) ──
from datetime import timezone, timedelta

VN_TZ = timezone(timedelta(hours=7))


def now_vn():
    """Current datetime in Vietnam timezone, stored as NAIVE (no tzinfo).
    SQLite strips timezone info, so we store VN time as naive datetime.
    MySQL also works fine with naive datetimes."""
    return datetime.now(VN_TZ).replace(tzinfo=None)


def fmt_vn(dt):
    """Format datetime as dd-mm-yyyy HH:MM:SS string for display.
    Assumes dt is already in VN time (naive, as stored by now_vn)."""
    if dt is None:
        return None
    return dt.strftime('%d-%m-%Y %H:%M:%S')

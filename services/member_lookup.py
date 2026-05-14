"""
Member lookup helper — find or create member by display_name.
Used by task, WP, subtask routes when frontend sends names.
"""

from extensions import db
from models import Member


def find_or_create_member(display_name):
    """Find member by display_name, create if not exists. Returns Member or None."""
    if not display_name or not display_name.strip():
        return None
    display_name = display_name.strip()
    m = Member.query.filter_by(display_name=display_name).first()
    if not m:
        m = Member(display_name=display_name)
        db.session.add(m)
        db.session.flush()
    return m


def find_or_create_members(names):
    """Find or create multiple members by display_name list. Returns list of Member."""
    if not names:
        return []
    members = []
    for name in names:
        m = find_or_create_member(name)
        if m:
            members.append(m)
    return members

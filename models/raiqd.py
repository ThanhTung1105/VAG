from extensions import db
from datetime import datetime, timezone
from services.date_utils import now_vn

RAIQD_TYPES = ('risk', 'issue', 'action', 'question', 'decision')
SEVERITY_LEVELS = ('low', 'medium', 'high', 'critical')


# Many-to-many: raiqd_item <-> raiqd_item (cross-links)
raiqd_links = db.Table(
    'raiqd_links',
    db.Column('from_id', db.BigInteger, db.ForeignKey('raiqd_items.id'), primary_key=True),
    db.Column('to_id', db.BigInteger, db.ForeignKey('raiqd_items.id'), primary_key=True),
)


class RaiqdItem(db.Model):
    __tablename__ = 'raiqd_items'

    id = db.Column(db.BigInteger().with_variant(db.Integer, "sqlite"), primary_key=True, autoincrement=True)
    item_type = db.Column(db.String(15), nullable=False)  # risk, issue, action, question, decision
    display_id = db.Column(db.String(20), nullable=True)  # Auto-gen: R-001, I-002, A-003, Q-004, D-005

    # Source: which work item this originates from
    source_table = db.Column(db.String(20), nullable=True)  # project, phase, work_package, task
    source_id = db.Column(db.BigInteger, nullable=True)

    # Impact: which work item is affected
    impact_table = db.Column(db.String(20), nullable=True)
    impact_id = db.Column(db.BigInteger, nullable=True)

    description = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(10), default='medium', nullable=False)
    raiqd_status = db.Column(db.String(10), default='open', nullable=False)  # open, closed
    resolution = db.Column(db.Text, nullable=True)
    deadline = db.Column(db.DateTime, nullable=True)

    pic_id = db.Column(db.BigInteger, db.ForeignKey('members.id'), nullable=True)
    detected_by_id = db.Column(db.BigInteger, db.ForeignKey('members.id'), nullable=True)
    decided_by_id = db.Column(db.BigInteger, db.ForeignKey('members.id'), nullable=True)  # for decisions
    closed_by_id = db.Column(db.BigInteger, db.ForeignKey('members.id'), nullable=True)

    created_at = db.Column(db.DateTime, default=now_vn, nullable=False)
    updated_at = db.Column(db.DateTime, default=now_vn,
                           onupdate=now_vn, nullable=False)

    pic = db.relationship('Member', foreign_keys=[pic_id], lazy='selectin')
    detected_by = db.relationship('Member', foreign_keys=[detected_by_id], lazy='selectin')
    decided_by = db.relationship('Member', foreign_keys=[decided_by_id], lazy='selectin')
    closed_by = db.relationship('Member', foreign_keys=[closed_by_id], lazy='selectin')

    # Self-referential many-to-many for cross-links
    linked_to = db.relationship(
        'RaiqdItem', secondary=raiqd_links,
        primaryjoin=(id == raiqd_links.c.from_id),
        secondaryjoin=(id == raiqd_links.c.to_id),
        lazy='selectin',
    )

    __table_args__ = (
        db.Index('ix_raiqd_source', 'source_table', 'source_id'),
        db.Index('ix_raiqd_type', 'item_type'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'item_type': self.item_type,
            'display_id': self.display_id,
            'source_table': self.source_table,
            'source_id': self.source_id,
            'impact_table': self.impact_table,
            'impact_id': self.impact_id,
            'description': self.description,
            'severity': self.severity,
            'raiqd_status': self.raiqd_status,
            'resolution': self.resolution,
            'deadline': self.deadline.isoformat() if self.deadline else None,
            'pic': self.pic.display_name if self.pic else None,
            'detected_by': self.detected_by.display_name if self.detected_by else None,
            'decided_by': self.decided_by.display_name if self.decided_by else None,
            'closed_by': self.closed_by.display_name if self.closed_by else None,
            'linked_to': [{'id': l.id, 'item_type': l.item_type, 'display_id': l.display_id} for l in self.linked_to],
        }

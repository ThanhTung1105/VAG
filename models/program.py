from extensions import db
from datetime import datetime, timezone
from services.date_utils import now_vn


class Program(db.Model):
    __tablename__ = 'programs'

    id = db.Column(db.BigInteger().with_variant(db.Integer, "sqlite"), primary_key=True, autoincrement=True)
    portfolio_id = db.Column(db.BigInteger, db.ForeignKey('portfolios.id'), nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    sort_order = db.Column(db.Integer, default=0, nullable=False)

    # Computed (cached)
    pct_finished = db.Column(db.Integer, default=0, nullable=False)
    pct_approved = db.Column(db.Integer, default=0, nullable=False)
    status = db.Column(db.String(20), default='not_started', nullable=False)
    health = db.Column(db.String(20), default='on_track', nullable=False)

    deliverable_url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=now_vn, nullable=False)
    updated_at = db.Column(db.DateTime, default=now_vn,
                           onupdate=now_vn, nullable=False)

    portfolio = db.relationship('Portfolio', back_populates='programs')
    projects = db.relationship('Project', back_populates='program',
                               order_by='Project.sort_order', lazy='selectin')

    def to_dict(self, nested=True):
        d = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'sort_order': self.sort_order,
            'pct_finished': self.pct_finished,
            'pct_approved': self.pct_approved,
            'status': self.status,
            'health': self.health,
        }
        if nested:
            d['projects'] = [p.to_dict(nested=True) for p in self.projects]
        return d

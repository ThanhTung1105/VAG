from extensions import db
from services.date_utils import now_vn


class ProjectAccess(db.Model):
    __tablename__ = 'project_access'

    id = db.Column(db.BigInteger().with_variant(db.Integer, "sqlite"), primary_key=True, autoincrement=True)
    member_id = db.Column(db.BigInteger, db.ForeignKey('members.id'), nullable=False)
    project_id = db.Column(db.BigInteger, db.ForeignKey('projects.id'), nullable=False)
    access_level = db.Column(db.String(10), nullable=False, default='view')  # full | edit | view
    created_at = db.Column(db.DateTime, default=now_vn, nullable=False)

    __table_args__ = (db.UniqueConstraint('member_id', 'project_id', name='uq_member_project'),)

    member = db.relationship('Member', back_populates='project_access')
    project = db.relationship('Project')

    def to_dict(self):
        return {
            'member_id': self.member_id,
            'project_id': self.project_id,
            'access_level': self.access_level,
            'member_name': self.member.display_name if self.member else None,
            'project_name': self.project.name if self.project else None,
        }

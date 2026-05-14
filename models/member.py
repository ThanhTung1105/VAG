from extensions import db
from datetime import datetime, timezone
from services.date_utils import now_vn


class Member(db.Model):
    __tablename__ = 'members'

    id = db.Column(db.BigInteger().with_variant(db.Integer, "sqlite"), primary_key=True, autoincrement=True)
    display_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(200), unique=True, nullable=True)
    password = db.Column(db.String(200), nullable=True)  # plain text for now
    avatar_url = db.Column(db.String(500), nullable=True)
    system_role = db.Column(db.String(10), default='user', nullable=False)  # admin | user
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    last_login = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=now_vn, nullable=False)

    # Project access relationship
    project_access = db.relationship('ProjectAccess', back_populates='member', lazy='selectin')

    def to_dict(self):
        return {
            'id': self.id,
            'display_name': self.display_name,
            'email': self.email,
            'password': self.password,
            'avatar_url': self.avatar_url,
            'system_role': self.system_role,
            'is_active': self.is_active,
        }

    @property
    def is_admin(self):
        return self.system_role == 'admin'

    def get_project_access(self, project_id):
        """Get access level for a specific project. Returns 'full'|'edit'|'view'|None."""
        for pa in self.project_access:
            if pa.project_id == project_id:
                return pa.access_level
        return None

    def get_accessible_project_ids(self):
        """Get all project IDs this user has explicit access to."""
        return {pa.project_id for pa in self.project_access}

    def is_involved_in_item(self, item):
        """Check if user is PIC, Approver, or Assignee of an item."""
        if hasattr(item, 'pic_id') and item.pic_id == self.id:
            return True
        if hasattr(item, 'approver_id') and item.approver_id == self.id:
            return True
        if hasattr(item, 'assignees'):
            if self in item.assignees:
                return True
        if hasattr(item, 'assignee_id') and item.assignee_id == self.id:
            return True
        return False

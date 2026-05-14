from extensions import db
from services.date_utils import now_vn

# M2M table
member_group_members = db.Table('member_group_members',
    db.Column('group_id', db.BigInteger, db.ForeignKey('member_groups.id'), primary_key=True),
    db.Column('member_id', db.BigInteger, db.ForeignKey('members.id'), primary_key=True),
)


class MemberGroup(db.Model):
    __tablename__ = 'member_groups'

    id = db.Column(db.BigInteger().with_variant(db.Integer, "sqlite"), primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    color = db.Column(db.String(7), default='#F97316', nullable=False)  # Orange default
    description = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=now_vn, nullable=False)

    members = db.relationship('Member', secondary=member_group_members, lazy='selectin',
                              backref=db.backref('groups', lazy='selectin'))

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'color': self.color,
            'description': self.description,
            'members': [{'id': m.id, 'name': m.display_name} for m in self.members],
            'member_names': [m.display_name for m in self.members],
        }

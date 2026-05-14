"""Member Groups API — CRUD for groups + member assignment."""
from flask import request, jsonify
from extensions import db
from routes import api
from models.member_group import MemberGroup
from models.member import Member
from services.member_lookup import find_or_create_member


@api.route('/member-groups', methods=['GET'])
def list_groups():
    groups = MemberGroup.query.order_by(MemberGroup.name).all()
    return jsonify([g.to_dict() for g in groups])


@api.route('/member-groups', methods=['POST'])
def create_group():
    data = request.get_json()
    g = MemberGroup(
        name=data['name'],
        color=data.get('color', '#F97316'),
        description=data.get('description', ''),
    )
    # Add members by name
    for name in data.get('member_names', []):
        m = find_or_create_member(name)
        if m:
            g.members.append(m)
    db.session.add(g)
    db.session.commit()
    return jsonify(g.to_dict()), 201


@api.route('/member-groups/<int:gid>', methods=['PUT'])
def update_group(gid):
    g = MemberGroup.query.get_or_404(gid)
    data = request.get_json()
    if 'name' in data:
        g.name = data['name']
    if 'color' in data:
        g.color = data['color']
    if 'description' in data:
        g.description = data['description']
    if 'member_names' in data:
        g.members.clear()
        for name in data['member_names']:
            m = find_or_create_member(name)
            if m:
                g.members.append(m)
    db.session.commit()
    return jsonify(g.to_dict())


@api.route('/member-groups/<int:gid>', methods=['DELETE'])
def delete_group(gid):
    g = MemberGroup.query.get_or_404(gid)
    db.session.delete(g)
    db.session.commit()
    return jsonify({'ok': True})


@api.route('/members-and-groups', methods=['GET'])
def list_members_and_groups():
    """Return both members and groups for picker popover."""
    members = Member.query.filter_by(is_active=True).order_by(Member.display_name).all()
    groups = MemberGroup.query.order_by(MemberGroup.name).all()
    return jsonify({
        'members': [{'id': m.id, 'name': m.display_name, 'role': '', 'email': m.email} for m in members],
        'groups': [g.to_dict() for g in groups],
    })

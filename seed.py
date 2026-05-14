"""
Seed script: Import the hardcoded DATA from demo_gantt.html into MySQL.

Usage:
    python seed.py           # seed the database
    python seed.py --reset   # drop all tables, recreate, and seed
"""

import sys
import json
import re
from datetime import datetime

from app import create_app
from extensions import db
from models import (
    Member, Portfolio, Program, Project, Phase,
    WorkPackage, Task, Subtask
)
from services.recalc import (
    recalc_from_task, recalc_from_wp, recalc_from_phase,
    recalc_from_project, recalc_from_program
)


# ─── Parse DATA from demo_gantt.html ──────────────────────────

def load_data_from_html(html_path='demo_gantt.html'):
    """Extract the JSON DATA object from the HTML file."""
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Match: var DATA = {...};
    match = re.search(r'var\s+DATA\s*=\s*(\{.*?\});\s*\n', content, re.DOTALL)
    if not match:
        raise ValueError("Could not find DATA object in HTML file")

    return json.loads(match.group(1))


# ─── Execution mode mapping ──────────────────────────────────

MODE_MAP = {
    'Independent': 'independent',
    'Online Meeting': 'online_meeting',
    'Offline Meeting': 'offline_meeting',
    'Workshop': 'workshop',
    'Site Visit': 'site_visit',
    'Presentation': 'presentation',
}


def _parse_date(s):
    if not s:
        return None
    return datetime.strptime(s, '%Y-%m-%d')


# ─── Member resolution ───────────────────────────────────────

_member_cache = {}


def get_or_create_member(name):
    """Get member by display_name, creating if needed."""
    if not name:
        return None
    name = name.strip()
    if name in _member_cache:
        return _member_cache[name]

    m = Member.query.filter_by(display_name=name).first()
    if not m:
        # Generate email from name: "Long NNL" → "long.nnl@vietanh-group.com"
        import unicodedata
        slug = unicodedata.normalize('NFD', name.lower())
        slug = ''.join(c for c in slug if unicodedata.category(c) != 'Mn')
        slug = slug.replace(' ', '.').replace('đ', 'd').replace('Đ', 'd')
        m = Member(
            display_name=name,
            email=slug + '@vietanh-group.com',
            password='123456',
            system_role='user',
        )
        db.session.add(m)
        db.session.flush()
    _member_cache[name] = m
    return m


# ─── Seed functions ──────────────────────────────────────────

def seed_subtask(st_data, task):
    assignee = get_or_create_member(st_data.get('assignee'))
    st = Subtask(
        task_id=task.id,
        content=st_data['name'],
        finish_status=st_data.get('finishStatus', 'unfinished'),
        assignee_id=assignee.id if assignee else None,
        sort_order=0,
    )
    db.session.add(st)
    db.session.flush()
    # M2M assignees
    assignee_names = st_data.get('assignees', [])
    if assignee_names:
        from services.member_lookup import find_or_create_members
        st.assignees = find_or_create_members(assignee_names)
    return st


def seed_task(t_data, wp, sort_idx):
    pic = get_or_create_member(t_data.get('pic'))
    approver = get_or_create_member(t_data.get('approver'))

    mode_raw = t_data.get('executionMode', 'Independent')
    mode = MODE_MAP.get(mode_raw, mode_raw.lower().replace(' ', '_'))

    t = Task(
        wp_id=wp.id,
        name=t_data['name'],
        execution_mode=mode,
        planned_start=_parse_date(t_data.get('plannedStart')),
        planned_finish=_parse_date(t_data.get('plannedFinish')),
        actual_start=_parse_date(t_data.get('actualStart')),
        actual_finish=_parse_date(t_data.get('actualFinish')),
        cancelled=t_data.get('cancelled', False),
        pic_id=pic.id if pic else None,
        approver_id=approver.id if approver else None,
        sort_order=sort_idx,
    )
    db.session.add(t)
    db.session.flush()

    # Assignees
    for name in t_data.get('assignees', []):
        m = get_or_create_member(name)
        if m:
            t.assignees.append(m)

    # Subtasks
    for si, st_data in enumerate(t_data.get('subtasks', [])):
        st = seed_subtask(st_data, t)
        st.sort_order = si
    db.session.flush()

    return t


def seed_wp(wp_data, phase, sort_idx):
    pic = get_or_create_member(wp_data.get('pic'))
    approver = get_or_create_member(wp_data.get('approver'))

    wp = WorkPackage(
        phase_id=phase.id,
        name=wp_data['name'],
        milestone=wp_data.get('milestone', 'none'),
        key_result=wp_data.get('ketQuaChinh'),
        planned_start=_parse_date(wp_data.get('plannedStart')),
        planned_finish=_parse_date(wp_data.get('plannedFinish')),
        cancelled=wp_data.get('cancelled', False),
        pic_id=pic.id if pic else None,
        approver_id=approver.id if approver else None,
        sort_order=sort_idx,
    )
    db.session.add(wp)
    db.session.flush()

    # Assignees
    for name in wp_data.get('assignees', []):
        m = get_or_create_member(name)
        if m:
            wp.assignees.append(m)

    # Tasks
    for ti, t_data in enumerate(wp_data.get('tasks', [])):
        seed_task(t_data, wp, ti)
    db.session.flush()

    return wp


def seed_phase(ph_data, project, sort_idx):
    ph = Phase(
        project_id=project.id,
        name=ph_data['name'],
        planned_start=_parse_date(ph_data.get('plannedStart')),
        planned_finish=_parse_date(ph_data.get('plannedFinish')),
        sort_order=sort_idx,
    )
    db.session.add(ph)
    db.session.flush()

    for wi, wp_data in enumerate(ph_data.get('workPackages', [])):
        seed_wp(wp_data, ph, wi)

    return ph


def seed_project(prj_data, program, sort_idx):
    prj = Project(
        program_id=program.id,
        name=prj_data['name'],
        description=prj_data.get('description'),
        sort_order=sort_idx,
    )
    db.session.add(prj)
    db.session.flush()

    for pi, ph_data in enumerate(prj_data.get('phases', [])):
        seed_phase(ph_data, prj, pi)

    return prj


def seed_program(prg_data, portfolio, sort_idx):
    prg = Program(
        portfolio_id=portfolio.id,
        name=prg_data['name'],
        description=prg_data.get('description'),
        sort_order=sort_idx,
    )
    db.session.add(prg)
    db.session.flush()

    for pi, prj_data in enumerate(prg_data.get('projects', [])):
        seed_project(prj_data, prg, pi)

    return prg


# ─── Recalculate everything bottom-up ────────────────────────

def recalc_all():
    """Run recalc cascade for all tasks (which propagates up)."""
    print("  Recalculating computed fields...")
    tasks = Task.query.all()
    for t in tasks:
        recalc_from_task(t)
    db.session.flush()
    print(f"  Done — recalculated {len(tasks)} tasks + cascaded up.")


# ─── Main ────────────────────────────────────────────────────

def main():
    reset = '--reset' in sys.argv

    # Determine HTML path
    import os
    html_candidates = [
        'demo_gantt_seed.html',
        'demo_gantt.html',
        'static/demo_gantt.html',
        '../pmo/demo_gantt.html',
    ]
    html_path = None
    for p in html_candidates:
        if os.path.exists(p):
            html_path = p
            break
    if not html_path:
        print("ERROR: demo_gantt.html not found. Place it in project root or static/")
        sys.exit(1)

    print(f"Loading DATA from {html_path}...")
    data = load_data_from_html(html_path)

    app = create_app()
    with app.app_context():
        # Disable auto-audit during seed (don't log seed inserts)
        from services.audit import disable_audit, enable_audit
        disable_audit()

        if reset:
            print("Dropping all tables...")
            db.drop_all()
            print("Creating all tables...")
            db.create_all()
        else:
            print("Creating tables (if not exist)...")
            db.create_all()

        # Check if data already exists
        existing = Portfolio.query.first()
        if existing:
            print(f"WARNING: Portfolio '{existing.name}' already exists.")
            ans = input("  Drop and re-seed? [y/N] ")
            if ans.strip().lower() != 'y':
                print("Aborted.")
                sys.exit(0)
            db.drop_all()
            db.create_all()

        # Create portfolio
        portfolio_name = data.get('portfolio', 'Việt Anh Group PMO')
        print(f"Creating portfolio: {portfolio_name}")
        portfolio = Portfolio(name=portfolio_name)
        db.session.add(portfolio)
        db.session.flush()

        # Seed programs
        for si, prg_data in enumerate(data.get('programs', [])):
            print(f"  Program: {prg_data['name']}")
            prg = seed_program(prg_data, portfolio, si)
            for prj in prg.projects:
                print(f"    Project: {prj.name}")
                for ph in prj.phases:
                    wp_count = len(ph.work_packages)
                    print(f"      Phase: {ph.name} ({wp_count} WPs)")

        # Recalc all computed fields
        recalc_all()

        # ════════════════════════════════════════════════
        # Set up users, passwords, and project access
        # ════════════════════════════════════════════════
        from models import ProjectAccess

        members = {m.display_name: m for m in Member.query.all()}
        projects = {p.name: p for p in Project.query.all()}

        # -- Long NNL: admin, full access everything --
        m = members.get('Long NNL')
        if m:
            m.system_role = 'admin'
            m.password = 'admin'
            for prj in projects.values():
                db.session.add(ProjectAccess(member_id=m.id, project_id=prj.id, access_level='full'))

        # -- Anh LTD: user, full access SAP, view M365, no access Tái cấu trúc --
        m = members.get('Anh LTD')
        if m:
            m.password = 'anh123'
            if 'SAP S/4HANA Cloud' in projects:
                db.session.add(ProjectAccess(member_id=m.id, project_id=projects['SAP S/4HANA Cloud'].id, access_level='full'))
            if 'Microsoft 365' in projects:
                db.session.add(ProjectAccess(member_id=m.id, project_id=projects['Microsoft 365'].id, access_level='view'))
            # No access to Tái cấu trúc → only sees items where is PIC/Approver

        # -- Hà NTT: user, edit SAP (only items involved), view M365 --
        m = members.get('Hà NTT')
        if m:
            m.password = 'ha123'
            if 'SAP S/4HANA Cloud' in projects:
                db.session.add(ProjectAccess(member_id=m.id, project_id=projects['SAP S/4HANA Cloud'].id, access_level='edit'))
            if 'Microsoft 365' in projects:
                db.session.add(ProjectAccess(member_id=m.id, project_id=projects['Microsoft 365'].id, access_level='view'))

        # -- Minh PT: user, edit SAP (only items involved), no other access --
        m = members.get('Minh PT')
        if m:
            m.password = 'minh123'
            if 'SAP S/4HANA Cloud' in projects:
                db.session.add(ProjectAccess(member_id=m.id, project_id=projects['SAP S/4HANA Cloud'].id, access_level='edit'))
            # No access to M365 or Tái cấu trúc → only sees items where involved

        # -- Citek Team: user, view SAP only --
        m = members.get('Citek Team')
        if m:
            m.password = 'citek123'
            if 'SAP S/4HANA Cloud' in projects:
                db.session.add(ProjectAccess(member_id=m.id, project_id=projects['SAP S/4HANA Cloud'].id, access_level='view'))

        # -- Add extra test users --
        extra_users = [
            ('Tùng NV', 'tung.nv@vietanh-group.com', 'tung123', 'user'),
            ('Lan PTH', 'lan.pth@vietanh-group.com', 'lan123', 'user'),
            ('Viewer Test', 'viewer@vietanh-group.com', 'viewer', 'user'),
        ]
        for name, email, pw, role in extra_users:
            existing = Member.query.filter_by(email=email).first()
            if not existing:
                new_m = Member(display_name=name, email=email, password=pw, system_role=role)
                db.session.add(new_m)
                db.session.flush()

                # Tùng NV: full M365, edit Tái cấu trúc
                if name == 'Tùng NV':
                    if 'Microsoft 365' in projects:
                        db.session.add(ProjectAccess(member_id=new_m.id, project_id=projects['Microsoft 365'].id, access_level='full'))
                    if 'Tái cấu trúc Holding' in projects:
                        db.session.add(ProjectAccess(member_id=new_m.id, project_id=projects['Tái cấu trúc Holding'].id, access_level='edit'))

                # Lan PTH: view all projects
                elif name == 'Lan PTH':
                    for prj in projects.values():
                        db.session.add(ProjectAccess(member_id=new_m.id, project_id=prj.id, access_level='view'))

                # Viewer Test: no project access at all → sees nothing (unless assigned)
                # (no ProjectAccess records)

        db.session.commit()

        # Print user summary
        print("\n═══ Users & Access ═══")
        all_members = Member.query.order_by(Member.id).all()
        all_projects = Project.query.order_by(Project.id).all()
        for m in all_members:
            access_str = []
            for prj in all_projects:
                level = m.get_project_access(prj.id)
                if level:
                    access_str.append(f'{prj.name[:15]}={level}')
            access_display = ', '.join(access_str) if access_str else '(chỉ item được assign)'
            print(f'  {m.display_name:15s} {m.email:35s} pw={m.password:10s} role={m.system_role:5s} | {access_display}')

        db.session.commit()

        # Summary
        print("\n═══ Seed Summary ═══")
        print(f"  Members:       {Member.query.count()}")
        print(f"  Portfolio:     {Portfolio.query.count()}")
        print(f"  Programs:      {Program.query.count()}")
        print(f"  Projects:      {Project.query.count()}")
        print(f"  Phases:        {Phase.query.count()}")
        print(f"  Work Packages: {WorkPackage.query.count()}")
        print(f"  Tasks:         {Task.query.count()}")
        print(f"  Subtasks:      {Subtask.query.count()}")
        print("═══════════════════")
        seed_groups()
        print("Seed complete!")

        # Re-enable audit after seeding
        enable_audit()


def seed_groups():
    """Seed member groups."""
    from models.member_group import MemberGroup
    from models.member import Member

    groups_data = [
        {'name': 'Ban Chiến Lược', 'color': '#F97316', 'members': ['Long NNL', 'Anh LTD']},
        {'name': 'Team IT', 'color': '#3B82F6', 'members': ['Long NNL', 'Hà NTT', 'Minh PT']},
        {'name': 'Citek SAP', 'color': '#8B5CF6', 'members': ['Citek Team']},
        {'name': 'Team M365', 'color': '#10B981', 'members': ['Long NNL', 'Tùng NV']},
    ]

    for gd in groups_data:
        g = MemberGroup(name=gd['name'], color=gd['color'])
        for mname in gd['members']:
            m = Member.query.filter_by(display_name=mname).first()
            if m:
                g.members.append(m)
        db.session.add(g)
    db.session.commit()
    print(f'  Groups:       {len(groups_data)}')


if __name__ == '__main__':
    main()


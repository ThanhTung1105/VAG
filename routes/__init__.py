from flask import Blueprint

api = Blueprint('api', __name__, url_prefix='/api')

# Import all route modules to register their routes on the blueprint
from routes import portfolios, subtasks, tasks, work_packages, phases, projects, programs, notes, trail, admin, auth, raiqd, member_groups  # noqa

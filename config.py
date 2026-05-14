import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

    # Local dev: mysql+pymysql://root:password@localhost/vietanh_pmo?charset=utf8mb4
    # PythonAnywhere: mysql+pymysql://user:pass@user.mysql.pythonanywhere-services.com/user$vietanh_pmo?charset=utf8mb4
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'sqlite:///pmo.db'
    )

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_recycle': 280,   # PythonAnywhere kills idle connections after 300s
        'pool_pre_ping': True,  # Check connection alive before using
    }

    # Vietnam timezone offset
    TZ_OFFSET = '+07:00'

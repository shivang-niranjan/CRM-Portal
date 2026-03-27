import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import SessionLocal, init_db
from app.models.user import User, UserRole
from app.core.auth import get_password_hash

def seed_users():
    db = SessionLocal()
    try:
        # Check existing users and enforce compatible hashing (pbkdf2_sha256)
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            print("Creating Admin user...")
            admin = User(
                username="admin",
                hashed_password=get_password_hash("admin123"),
                full_name="System Administrator",
                role=UserRole.ADMIN
            )
            db.add(admin)
        elif admin.hashed_password.startswith("$2"):
            print("Re-hashing Admin password with pbkdf2_sha256")
            admin.hashed_password = get_password_hash("admin123")

        citizen = db.query(User).filter(User.username == "citizen").first()
        if not citizen:
            print("Creating Citizen user...")
            citizen = User(
                username="citizen",
                hashed_password=get_password_hash("citizen123"),
                full_name="John Doe",
                role=UserRole.CITIZEN
            )
            db.add(citizen)
        elif citizen.hashed_password.startswith("$2"):
            print("Re-hashing Citizen password with pbkdf2_sha256")
            citizen.hashed_password = get_password_hash("citizen123")
            db.add(citizen)
            
        worker = db.query(User).filter(User.username == "worker").first()
        if not worker:
            print("Creating Worker user...")
            worker = User(
                username="worker",
                hashed_password=get_password_hash("worker123"),
                full_name="Mike Fieldman",
                role=UserRole.WORKER
            )
            db.add(worker)
        elif worker.hashed_password.startswith("$2"):
            print("Re-hashing Worker password with pbkdf2_sha256")
            worker.hashed_password = get_password_hash("worker123")
            
        db.commit()
        print("Users seeded successfully!")
    except Exception as e:
        print(f"Error seeding users: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_users()

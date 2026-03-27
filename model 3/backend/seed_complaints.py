import sys
import os
import random
from datetime import datetime, timedelta

# Add current directory to path to import app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.base import SessionLocal, Base, engine
from app.models.ticket import MasterTicket, CitizenReport, TicketCategory, TicketStatus, TicketPriority, Department, Worker, RedZone
from app.models.user import User, UserRole

def seed_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        from sqlalchemy import text
        db.execute(text("DELETE FROM citizen_reports"))
        db.execute(text("DELETE FROM ticket_status_history"))
        db.execute(text("DELETE FROM master_tickets"))
        db.execute(text("DELETE FROM workers"))
        db.execute(text("DELETE FROM departments"))
        db.execute(text("DELETE FROM red_zones"))
        db.commit()

        print("Seeding Departments with stats...")
        depts_data = [
            {"name": "Delhi Electricity Board", "code": "DEB", "category": TicketCategory.ELECTRICITY, "resolved": 145, "time": 18.5, "sat": 8.5},
            {"name": "Delhi Jal Board", "code": "DJB", "category": TicketCategory.WATER, "resolved": 132, "time": 24.2, "sat": 7.8},
            {"name": "Public Works Dept (PWD)", "code": "PWD", "category": TicketCategory.ROADS, "resolved": 210, "time": 36.8, "sat": 6.5},
            {"name": "MCD Sanitation", "code": "MCD", "category": TicketCategory.SANITATION, "resolved": 320, "time": 12.4, "sat": 9.1},
        ]
        
        dept_objs = []
        for d in depts_data:
            dept = Department(
                name=d["name"], 
                code=d["code"], 
                category=d["category"],
                total_tickets_resolved=d["resolved"],
                avg_resolution_time_hours=d["time"],
                satisfaction_score=d["sat"]
            )
            dept.calculate_efficiency()
            db.add(dept)
            db.flush()
            dept_objs.append(dept)
        
        print("Seeding Workers...")
        worker_user = db.query(User).filter(User.username == "worker").first()
        if worker_user:
            worker = Worker(
                name="Deepak Sharma",
                employee_id="DEL-W-001",
                department_id=dept_objs[0].id,
                user_id=worker_user.id,
                tickets_completed=45,
                rating=4.8
            )
            db.add(worker)
            db.flush()
            worker_obj = worker
        else:
            worker_obj = None

        print("Seeding Clustered Data in Delhi...")
        citizen_user = db.query(User).filter(User.username == "aarav").first()
        aarav_id_str = str(citizen_user.id) if citizen_user else "4"
        # Delhi Coordinates (Connaught Place area)
        lat_base, lon_base = 28.6328, 77.2197
        
        sources = ["CRM Website", "Instagram", "Facebook", "Voice"]
        
        # Delhi Power Users for the leaderboard
        power_users = [
            "Aarav Sharma", "Priya Patel", "Vikram Singh", 
            "Sneha Gupta", "Rahul Verma", "Kavita Reddy", 
            "Amit Kumar", "Neha Desai", "Rajiv Malhotra", "Anjali Tiwari"
        ]

        descriptions = {
            TicketCategory.ELECTRICITY: [
                "Transformer spark near Rajiv Chowk Metro",
                "Frequent power fluctuations in Block B, CP",
                "Dangling high-tension wires on Barakhamba Road",
                "Street light off on Janpath for 3 days",
                "Sparking near electric pole in Bengali Market"
            ],
            TicketCategory.WATER: [
                "Major pipeline burst on Kasturba Gandhi Marg",
                "Dirty water supply in Minto Road quarters",
                "Low water pressure near Hanuman Mandir",
                "Water leaking from main valve in Block G",
                "Open manhole with water overflow in CP"
            ],
            TicketCategory.ROADS: [
                "Dangerous pothole on Sansad Marg",
                "Broken divider near Shivaji Stadium",
                "Illegal parking blocking PWD maintenance vehicles",
                "Collapsed footpath near Outer Circle",
                "Road cave-in near Tolstoy Marg"
            ],
            TicketCategory.SANITATION: [
                "Garbage pile-up behind Palika Bazaar",
                "Public toilets overflow near Regal building",
                "Unauthorized dumping in Shantipath",
                "Sewerage blockage in Scindia House area",
                "Dead animal carcass near Super Mart"
            ]
        }

        # Create 15 Clustered Issues (MasterTickets)
        for i in range(15):
            cat = random.choice(list(TicketCategory))
            desc = random.choice(descriptions[cat])
            
            # Master location
            lat = lat_base + random.uniform(-0.015, 0.015)
            lon = lon_base + random.uniform(-0.015, 0.015)
            
            status = random.choice([TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, TicketStatus.ON_SITE])
            priority = random.choice([TicketPriority.HIGH, TicketPriority.CRITICAL])
            
            # Create MasterTicket
            mt = MasterTicket(
                category=cat,
                description=desc,
                latitude=lat,
                longitude=lon,
                status=status,
                priority=priority,
                urgency_score=round(random.uniform(7.0, 9.8), 1),
                report_count=random.randint(5, 25) # Highly clustered
            )
            
            # Assign dept and worker
            matching_dept = next((d for d in dept_objs if d.category == cat), dept_objs[0])
            mt.assigned_department_id = matching_dept.id
            if worker_obj:
                mt.assigned_worker_id = worker_obj.id
            
            db.add(mt)
            db.flush()
            
            # Create MANY CitizenReports for this cluster, distributing them heavily to power users
            for j in range(mt.report_count):
                source = random.choice(sources)
                # 70% chance to be reported by a power user
                if random.random() < 0.7:
                    citizen = random.choice(power_users[:5]) if random.random() < 0.5 else random.choice(power_users)
                else:
                    citizen = f"Delhi Resident {random.randint(1, 1000)}"
                    
                cr = CitizenReport(
                    description=f"[{source}] {desc} (Report #{j+1})",
                    latitude=lat + random.uniform(-0.0005, 0.0005),
                    longitude=lon + random.uniform(-0.0005, 0.0005),
                    category=cat,
                    master_ticket_id=mt.id,
                    citizen_name=citizen,
                    citizen_id=aarav_id_str if citizen == "Aarav Sharma" else None,
                    source=source
                )
                db.add(cr)

        # Create 10 Isolated Issues
        for i in range(10):
            cat = random.choice(list(TicketCategory))
            desc = random.choice(descriptions[cat])
            
            lat = lat_base + random.uniform(-0.03, 0.03)
            lon = lon_base + random.uniform(-0.03, 0.03)
            
            status = random.choice([TicketStatus.REPORTED, TicketStatus.RESOLVED])
            priority = random.choice([TicketPriority.LOW, TicketPriority.MEDIUM])
            
            mt = MasterTicket(
                category=cat,
                description=desc,
                latitude=lat,
                longitude=lon,
                status=status,
                priority=priority,
                urgency_score=round(random.uniform(2.0, 5.5), 1),
                report_count=1
            )
            db.add(mt)
            db.flush()
            
            source = random.choice(sources)
            cr = CitizenReport(
                description=desc,
                latitude=lat,
                longitude=lon,
                category=cat,
                master_ticket_id=mt.id,
                citizen_name="Delhi Resident",
                source=source
            )
            db.add(cr)

        print("Seeding Red Zones (Predictive Analysis)...")
        red_zones = [
            {"lat": 28.6448, "lon": 77.2213, "cat": TicketCategory.ELECTRICITY, "risk": "critical", "action": "Immediate transformer replacement recommended."},
            {"lat": 28.6256, "lon": 77.2100, "cat": TicketCategory.WATER, "risk": "high", "action": "Corroded main line detected. Proactive relining needed."},
            {"lat": 28.6180, "lon": 77.2300, "cat": TicketCategory.ROADS, "risk": "medium", "action": "Repeated cave-ins. Conduct structural soil survey."},
            {"lat": 28.6360, "lon": 77.2280, "cat": TicketCategory.SANITATION, "risk": "high", "action": "Legacy sewer line overflow. Expand capacity in Phase 2."}
        ]
        
        for rz in red_zones:
            last_fail = datetime.now() - timedelta(days=random.randint(0, 5))
            # Proactive data
            pred_fail = last_fail + timedelta(days=random.randint(7, 14))
            maint_deadline = pred_fail - timedelta(days=3)
            
            zone = RedZone(
                latitude=rz["lat"],
                longitude=rz["lon"],
                category=rz["cat"],
                risk_level=rz["risk"],
                recommended_action=rz["action"],
                failure_count_30d=random.randint(8, 15),
                failure_count_90d=random.randint(25, 40),
                last_failure_at=last_fail,
                predicted_failure_at=pred_fail,
                proactive_maintenance_deadline=maint_deadline,
                improvement_suggestion=f"Proactive Alert: High frequency failure detected. Scheduled maintenance required by {maint_deadline.strftime('%Y-%m-%d')} to prevent total asset breakdown."
            )
            db.add(zone)

        db.commit()
        print("Successfully seeded Delhi data with clusters, sources, and red zones!")
        
    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()

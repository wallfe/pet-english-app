#!/usr/bin/env python3
"""
Initialize BBC Learning English SQLite database
"""
import sqlite3
from pathlib import Path

def init_database(db_path: str = "data/bbc_learning.db"):
    """Initialize database with schema"""
    db_file = Path(db_path)
    db_file.parent.mkdir(parents=True, exist_ok=True)

    schema_file = Path(__file__).parent / "bbc_learning.sql"

    print(f"Initializing database at: {db_file}")

    # Connect and execute schema
    conn = sqlite3.connect(db_file)
    with open(schema_file, 'r', encoding='utf-8') as f:
        schema_sql = f.read()

    conn.executescript(schema_sql)
    conn.commit()

    # Verify tables created
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [row[0] for row in cursor.fetchall()]

    print(f"✓ Created {len(tables)} tables:")
    for table in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        print(f"  - {table}: {count} rows")

    conn.close()
    print(f"\n✓ Database initialized successfully at {db_file}")

if __name__ == "__main__":
    init_database()

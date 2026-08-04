from database import get_db

NGOS = [
    ("Annapurna Farmer Trust",
     "Provides interest-free seed and input loans to smallholder farmers in drought-prone Marathwada, so families are not pushed toward informal moneylenders before sowing season.",
     "Farmer debt relief", "Latur, Maharashtra", "https://example.org/annapurna"),
    ("Beej Bachao Collective",
     "Runs community seed banks preserving indigenous varieties of jowar, bajra and pulses, and trains farmers in saving and exchanging their own seed.",
     "Seed sovereignty", "Nashik, Maharashtra", "https://example.org/beejbachao"),
    ("Sakhi Kisan Sangathan",
     "Supports women farmers with land-rights paperwork, cooperative formation, and direct market access so they are recognised as cultivators in their own right.",
     "Women farmers", "Solapur, Maharashtra", "https://example.org/sakhikisan"),
    ("Paani Foundation for Fields",
     "Builds farm ponds, contour trenches and watershed structures with village labour, cutting irrigation costs for hundreds of marginal farms.",
     "Water conservation", "Ahmednagar, Maharashtra", "https://example.org/paanifields"),
    ("Kisan Shiksha Kendra",
     "Pays school and college fees for children of farming families facing crop failure, so education is not the first thing sacrificed in a bad year.",
     "Farmer family education", "Kolhapur, Maharashtra", "https://example.org/kisanshiksha"),
]

with get_db() as conn:
    cur = conn.cursor()
    for name, desc, focus, loc, site in NGOS:
        cur.execute('SELECT id FROM ngos WHERE name = %s', (name,))
        if cur.fetchone():
            print('skip (exists):', name)
            continue
        cur.execute("""
            INSERT INTO ngos (name, description, focus_area, location, website, is_verified)
            VALUES (%s,%s,%s,%s,%s,TRUE)
        """, (name, desc, focus, loc, site))
        print('added:', name)

with get_db() as conn:
    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) AS n FROM ngos')
    print('\ntotal NGOs:', cur.fetchone()['n'])
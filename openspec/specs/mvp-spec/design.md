# MVP Architecture & Schema Design

## 1. Core Architecture (Identity vs. State)
To support true season-to-season persistence, the data model decouples a Club's/Player's *identity* from their *seasonal state*.
- **`Club`** and **`Player`** models represent persistent identity across all seasons.
- **`ClubSeason`** and **`PlayerSeason`** handle all season-scoped state, including starting XIs and attributes.

## 2. The 14-Position Model
Players are strictly mapped to one of 14 positions via a database enum:
`GK, DL, DC, DR, DML, DMC, DMR, ML, MC, MR, AML, AMC, AMR, ST`

For the MVP, only 8 of these are actively populated by the generation logic to fill the fixed 4-4-2 formation (GK, DL, DC, DR, ML, MC, MR, ST). The squad allocation for the 20 players is fixed to: 2 GK, 2 DL, 3 DC, 2 DR, 2 ML, 3 MC, 2 MR, 4 ST.

## 3. The Top-Eleven Attribute Model
The 5-attribute system is replaced by the full 25-attribute Top-Eleven profile, modeled as nullable integers based on position.

- **Defense Category (Int?, null for GK):** `tackling`, `marking`, `positioning`, `heading`, `bravery`
- **Attack Category (Int?, null for GK):** `passing`, `dribbling`, `crossing`, `shooting`, `finishing`
- **Physical Category (Int, required for all):** `fitness`, `strength`, `aggression`, `speed`, `creativity`
- **Goalkeeping Category (Int?, null for outfield):** `reflexes`, `agility`, `anticipation`, `rushingOut`, `communication`, `throwing`, `kicking`, `punching`, `aerialReach`, `concentration`

### Overall Rating (OVR)
Both Outfield players and Goalkeepers have exactly 15 applicable non-null attributes.
**OVR = sum(all 15 non-null attributes) / 15**

## 4. Migration Strategy: The "Clean Slate"
The MVP database will be wiped using `prisma migrate reset`. No existing data will be preserved. The seeder will instantiate the new schemas from scratch.
- **Season 1 (Genesis):** Players and attributes are randomly generated.
- **Season 2+ (Rollover):** Exact copy-forward of prior season's `clubId`, `position`, and all attributes. OVR is recomputed from the copied attributes.

## 5. Match Engine: Two-Layer Model
The match engine eschews individual attribute tracking per event in favor of a macro-then-micro architecture.

**Layer 1: Possession (Macro)**
- Before the match, compute Team Strength = Average OVR of the starting XI.
- `Possession% = strengthA / (strengthA + strengthB) × 100`

**Layer 2: Event Generation (Micro)**
- The team with higher possession is proportionally biased to initiate more events.
- An event type is drawn (shot, pass, dribble, tackle, foul, corner, free_kick).
- Event resolution pits category averages against each other (e.g., Attack category avg vs. Defense category avg).
- `success_chance = attacker_category_avg / (attacker_category_avg + defender_category_avg)`

## 6. Prisma Schema
```prisma
enum Position {
  GK
  DL
  DC
  DR
  DML
  DMC
  DMR
  ML
  MC
  MR
  AML
  AMC
  AMR
  ST
}

model Club {
  id           String       @id @default(uuid())
  name         String
  createdAt    DateTime     @default(now())
  
  seasons      ClubSeason[]
  homeFixtures Fixture[]    @relation("HomeFixtures")
  awayFixtures Fixture[]    @relation("AwayFixtures")
}

model ClubSeason {
  clubId     String
  seasonId   String
  club       Club           @relation(fields: [clubId], references: [id])
  season     Season         @relation(fields: [seasonId], references: [id])
  
  startingXI StartingXI?
  players    PlayerSeason[] // Links players to this specific club-season
  
  @@id([clubId, seasonId])
  @@index([seasonId])
}

model StartingXI {
  id         String     @id @default(uuid())
  clubId     String
  seasonId   String
  playerIds  Json       // Array of 11 player UUIDs
  computedAt DateTime   @default(now())
  clubSeason ClubSeason @relation(fields: [clubId, seasonId], references: [clubId, seasonId])
  
  @@unique([clubId, seasonId])
}

model Player {
  id        String         @id @default(uuid())
  name      String
  createdAt DateTime       @default(now())
  seasons   PlayerSeason[]
}

model PlayerSeason {
  playerId      String
  seasonId      String
  clubId        String
  
  player        Player     @relation(fields: [playerId], references: [id])
  season        Season     @relation(fields: [seasonId], references: [id])
  clubSeason    ClubSeason @relation(fields: [clubId, seasonId], references: [clubId, seasonId])
  
  position      Position
  overallRating Float

  // Defense (Nullable)
  tackling      Int?
  marking       Int?
  positioning   Int?
  heading       Int?
  bravery       Int?

  // Attack (Nullable)
  passing       Int?
  dribbling     Int?
  crossing      Int?
  shooting      Int?
  finishing     Int?

  // Physical (Required)
  fitness       Int
  strength      Int
  aggression    Int
  speed         Int
  creativity    Int

  // Goalkeeping (Nullable)
  reflexes      Int?
  agility       Int?
  anticipation  Int?
  rushingOut    Int?
  communication Int?
  throwing      Int?
  kicking       Int?
  punching      Int?
  aerialReach   Int?
  concentration Int?
  
  @@id([playerId, seasonId])
  @@index([clubId, seasonId])
  @@index([seasonId])
}
```

# bot-transfer-behavior — Design Notes

## Spending Appetite
`BotPersonality { clubId, spendingAppetite: number (0.0–1.0) }` — generated once per club at season start. Higher values raise the bot's effective bid ceiling (as a multiplier of the player's listed price) and increase how many times it will re-bid after being outbid.

## "Genuine Improvement" Definition
A scouted player is a genuine improvement if their position-relevant rating (from `squad-initialization`'s Overall Rating) exceeds the current weakest squad member in the same position group by a configurable margin (suggested default: any positive margin qualifies for MVP; a minimum-margin threshold can be tuned later).

## "Viable Replacement" Definition
A scout-list player counts as a viable replacement for a starting player if they share the same position group and their rating is at least the starting player's rating minus a configurable tolerance (suggested default: 0, i.e. equal or better).

## Decision Flow (buying)
```
for player in scoutList:
  if not isGenuineImprovement(player): continue
  maxBid = listedPrice(player) * spendingAppetiteDerivedMultiplier
  if tokenBalance >= minimumViableBid: placeBid(player, amount)
  on outbid: reBid up to maxBid, bounded by spendingAppetite-derived retry count
```

## Decision Flow (selling)
```
on offer(player):
  if player not in startingXI: acceptHighestOffer()
  else:
    if scoutListHasViableReplacement(player.position): acceptOffer()
    else: rejectOffer(counter = none)
```

# About
Discord bot + Google Sheets API for the club "CandyHouse" on Blue Archive.  
A project I started on 13/12/22 for some coding practice (and to freshen up on JavaScript).  
  
Created with Discord API, Google Sheets API, as well as Node.js.

### Terminology
+ **Student:** What Blue Archive players call their characters.  
+ **Skills:** Refers to the level and star of a student's "unique equipment," as well as their skill levels.


# Commands
* Prefix is modifiable (by code).  
* Currently "$"  
* No parameter is case-sensitive.  


## test  
**Format:** `test`  
Causes the bot to respond with a test response message on the channel where the message was sent.  
### Example usage:  
```
$test
```

## help  
**Format:** `help`
Bot will post the pre-made help page.  
The help page is a DiscordEmbed object with hard-coded text.  
### Example usage:  
```
$help
```

## register  
**Format:** `register [in-game name]`  
  
Binds the user's Discord ID to an in-game name on the Google Sheets.  
Cannot currently be undone without manually modifying the sheets.  
### Example usage:  
```
$register Coronne  
$register Horou  
```

## member  
**Format:** `member [username]`  
  
Pulls member details from Google Sheets including:
- Club join date
- In-game username
- Current logged status
- Discord tag (if registered on sheets)  
- Discord avatar (if registered on sheets)
- Invested characters, categorized by damage type  

Also accepts discord mention (<@ID>) as `[username]` parameter.  
### Example usage:
```
$member Coronne
$member Horou
$member <@123456789987654321>
```

## status  
**Format:** `status [username] "[description]"`  
The [description] parameter ***NEEDS*** to be enclosed with quotation marks (").  
  
Overwrites current status entry on the member sheet.  
Whitespace or blank inputs will be rejected.  
### Example usage:  
```
$status Coronne "Taking a break."
$status Horou "gna be on vacation fr a while"
```

## away  
**Format:** `away`  
  
Sends a list of players with filled "status" boxes on the member sheet, as well as the corresponding status.  
### Example usage:  
```
$away
```

## skills  
**Format:** `skills [username] [student]`  
  
Pulls the skill details of a member's student from the Google Sheets.  
Will take student names with whitespaces and brackets to accommodate for seasonal variants.
### Example usage:  
```
$skills Coronne Maki
$skills Horou Aru
$skills Horou Aru (New Year)
```

## skillsupdate  
**Format:** `skillsupdate [username] [student] "[status]"`  
The [status] parameter ***NEEDS*** to be enclosed with quotation marks (").  
  
Overwrites current skill entry on the Google Sheets for the specified user and student.  
Conditional formatting on the Google Sheets will automatically colour the cell depending on the text.  
No input vaildation, but preferred if input is in the format: `UE## ####`, where each # is a number, or M for the skill part.
### Example usage:  
```
$skillsupdate Coronne Maki "UE40 MMMM"
$skillsupdate Horou Aru (New Year) "UE30 4MMM"
```  

## student  
**Format:** `student [student]`  
  
Sends a list of all players who have entries for the specified student, as well as the corresponding skill entry.  
Will take student names with whitespaces and brackets to accommodate for seasonal variants.  
### Example usage:
```
$student Maki
$student Aru (New Year)
$student Shiroko (Riding)
```

require("dotenv").config();
const {Client, GatewayIntentBits, discordSort, MessageManager, channelLink, Guild} = require("discord.js");
const {google} = require("googleapis");
const { EmbedBuilder } = require('discord.js');
const nodemon = require("nodemon");

const prefix = "$";
const spreadsheetId = process.env.SPREADSHEET;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

function getBracketTerm(string) {
    const bracketRegex = (/\(.[^\(]+\)/)
    let bracketTerm = string.match(bracketRegex)
    if (bracketTerm == null) {
        return null
    }
    
    bracketTerm = "(" + bracketTerm[0].replace(/[\)\()]/g, "").trim() + ")"
    console.log(bracketTerm)
    const bracketTermLeft = bracketTerm.match(/^\(.+\s{1}/)
    console.log(bracketTermLeft)
    if (bracketTermLeft == null) {
        return bracketTerm
    }
    const bracketTermRight = bracketTerm.replace(bracketTermLeft[0], "")

    bracketTerm = bracketTermLeft[0].trim() + " " + bracketTermRight
    return bracketTerm
}

async function start() {
    memberRange = process.env.MEMBERRANGE
    redRange = process.env.REDRANGE
    blueRange = process.env.BLUERANGE
    yellowRange = process.env.YELLOWRANGE

    // Guild client
    candyHouse = client.guilds.cache.find((g) => g.id == process.env.GUILDID)

    // Sheets auth token
    auth = new google.auth.GoogleAuth({
        keyFile: "credentials.json",
        scopes: "https://www.googleapis.com/auth/spreadsheets"
    });

    // Instantiate client
    googleClient = await auth.getClient();

    // Sheets API instance
    googleSheets = google.sheets({
        version: "v4",
        auth: googleClient
    });

    // Row data for red characters
    const redCharacters = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: process.env.REDRANGECHAR
    })

    // Row data for blue characters
    const blueCharacters = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: process.env.BLUERANGECHAR
    })    

    // Row data for yellow characters
    const yellowCharacters = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: process.env.YELLOWRANGECHAR
    })
    
    /* 
    
    
    SHEET RANGES
    

    */

    // RED - EXPLOSIVE
    redSheet = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: redRange
    })

    // BLUE - MYSTIC
    blueSheet = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: blueRange
    })

    // YELLOW - PIERCING
    yellowSheet = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: yellowRange
    })

    // MEMBERS
    memberSheet = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: memberRange
    })


    // All character data: RBY
    characters = [redCharacters.data.values[0], blueCharacters.data.values[0], yellowCharacters.data.values[0]];
    characterMetaData = [redCharacters, blueCharacters, yellowCharacters];

    // All character ranges: RBY
    characterRanges = [redRange, blueRange, yellowRange];

    // All character sheets: RBY
    characterSheets = [redSheet, blueSheet, yellowSheet]

    // Map
    characterMap = {}
    for (let i = 0; i < characters.length; i++) {
        for (let j = 0; j < characters[i].length; j++) {
            characterMap[characters[i][j].toLowerCase()] = [characters[i][j], j, characterRanges[i], characterSheets[i]]
        }
    }
}

async function isRegistered(id) {
    let rowData = memberSheet.data.values
    
    for (let i = 0; i < rowData.length; i++) {
        if (id === rowData[i][4]) {
            return [true, rowData[i][1]]
        }
    }
    return false
}

async function register(username, id) {
    // Row data

    const rowData = memberSheet.data.values

    for (let i = 0; i < rowData.length; i++) {
        if (rowData[i][4] == id) {
            return [false, rowData[i][1]]
        }
    }

    for (let i = 0; i < rowData.length; i++) {
        if (typeof rowData[i][1] !== "undefined" && rowData[i][1].toLowerCase() == username.toLowerCase()) {
            const range = "CandyHouse!R" + (3 + i) + "C" + 6
            rowWrite(range, [[id]], "RAW")
            return [true, rowData[i][1]]
        }
    }

    return [false, ""]
}

async function charSearch(charSheet, characters, memberName) {

    const rowData = charSheet.data.values
    
    let characterNames = []
    for (let i = 0; i < rowData.length; i++) {
        if (typeof rowData[i][0] !== "undefined" && rowData[i][0].toLowerCase() === memberName.toLowerCase()) {
            for (let j = 1; j < rowData[i].length; j++) {
                if (typeof rowData[i][j] !== "undefined" && rowData[i][j].trim().length > 0) {
                    characterNames.push(characters[j-1])
                }
            }
            break
        }
    }

    return characterNames
}

async function awaySearch() {

    const rowData = memberSheet.data.values

    let away = []
    for (let i = 0; i < rowData.length; i++) {
        if (typeof rowData[i][2] !== "undefined" && rowData[i][2].length > 0) {
            away.push([rowData[i][1], rowData[i][2]])
        }
    }
    return away
}

async function investmentSearch(characterSheet, index) {
    const rowData = characterSheet.data.values

    let people = []
    for (let i = 0; i < rowData.length; i++) {
        if (typeof rowData[i][index] !== "undefined" && rowData[i][index].length > 0) {
            people.push("> " + [rowData[i][0] + ": \`" + rowData[i][index]] + "\`")
        }
    }

    return people
}

async function rowWrite(sheetRange, content, inputOption) {
    await googleSheets.spreadsheets.values.update({
        auth,
        spreadsheetId,
        range: sheetRange,
        valueInputOption: inputOption,
        resource: {
            values: content
          }
    })
}

async function characterRowSearch(sheetRange, member, message) {
    
    // Row data
    const rows = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: sheetRange
    })
    //console.log(rows.data.values)

    const rowData = rows.data.values

    try {
        for (let i = 0; i < rowData.length; i++) {
            if (rowData[i][0].toLowerCase() === member.toLowerCase()) {
                return [rowData[i], i]
            }
        }
        await message.reply("Error: Member \`" + member + "\` not found.")

    } catch(err) {
        console.log(err, "*");
        await message.reply("Error: Member \`" + member + "\` not found.")
    }
    
}

async function memberRowSearch(member, message) {

    const rowData = memberSheet.data.values
    try {
        for (let index = 0; index < rowData.length; index++) {
            if (typeof rowData[index][1] !== "undefined" && rowData[index][1].toLowerCase() === member.toLowerCase()) {
                return [rowData[index], index]
            }
        }
        return []

    } catch(err) {
        await message.reply("Error: Member \`" + member + "\` not found.")
        console.log(err, "*")
    }
}

client.once("ready", async () => {
    await start()
    client.user.setPresence({
        status: "online",
        activities: [{
            name: "$help | CandyHouse",
        }],
        type: "PLAYING"
    })

    console.log(
        "***********************************************************\n\n" +
        "CandyBot logged in with user:\n" + client.user.tag + " | " + client.user + "\n\n" +
        "***********************************************************"
    );
});


client.on("messageCreate", async (message) => {

    splitMessage = message.content.split(" ");

    if (splitMessage[0].startsWith(prefix)) {

        // Prefix logger
        console.log(
            "-----------------------------------------------------------\n\n" +
            "Prefix called by user " + message.author.tag + " | " + message.author + "\n" +
            "Message content: " + message.content + "\n\n" +
            "-----------------------------------------------------------"
        )

        // Commands
        const memberCmd = "member"
        const statusUpdateCmd = "status"
        const weaponStatusCmd = "skills"
        const weaponUpdateCmd = "skillsupdate"
        const investmentCmd = "student"
        const awayCmd = "away"
        const registerCmd = "register"


        switch (splitMessage[0].substring(1).toLowerCase()) {
            case "test":
                await message.reply("Test.")

                // END
                break;

            case "help":
                // Variables for help messages
                const investmentCmdHelp = 
                "Shows all members with the designated student invested and their investment.\n" +
                "\`" + prefix + investmentCmd + " [student name]\`\n" +
                "\`" + prefix + investmentCmd + " Maki\`"

                const weaponStatusCmdHelp = 
                "Shows the weapon status of a member's student.\n" +
                "\`" + prefix + weaponStatusCmd + " [username] [student name]\`\n" +
                "\`" + prefix + weaponStatusCmd + " R Azusa\`"

                const weaponUpdateCmdHelp = 
                "Updates the weapon status of a member's student. Enclose the status with quotation marks (\").\n" +
                "\`" + prefix + weaponUpdateCmd + " [username] [student name] \"status\"\`\n" +
                "\`" + prefix + weaponUpdateCmd + " Coronne Iroha \"UE20 2117\"\`"

                const memberCmdHelp = 
                "Shows the username, status, and join date of member.\n" +
                "\`" + prefix + memberCmd + " [username]\`\n" +
                "\`" + prefix + memberCmd + " R\`"

                const statusUpdateCmdHelp =
                "Updates the status of a member. Enclose the status with quotation marks (\").\n" +
                "\`" + prefix + statusUpdateCmd + " [username] \"status\"\`\n" +
                "\`" + prefix + statusUpdateCmd + " Coronne \"Finishing essays\"\`"

                const awayCmdHelp = 
                "Shows all members with a written \`Note\` on the Google Sheets.\n" +
                "\`" + prefix + awayCmd + "\`"

                const registerCmdHelp =
                "Registers your Discord ID to a Blue Archive username on the Google Sheets. \n" +
                "\`" + prefix + registerCmd + "\`\n" +
                "\`" + prefix + registerCmd + " Coronne" + "\`"

                // New reply command
                const helpEmbed = new EmbedBuilder()
	                .setColor(0x0099FF)
	                .setTitle('Commands')
	                .setDescription('Contact <@' + process.env.GODSEL + '> for further assistance.')
	                .setThumbnail(client.user.displayAvatarURL())
	                .addFields(
	                	{ name: prefix + investmentCmd, value: investmentCmdHelp },
	                	{ name: prefix + weaponStatusCmd, value: weaponStatusCmdHelp },
	                	{ name: prefix + weaponUpdateCmd, value: weaponUpdateCmdHelp },
                        { name: prefix + memberCmd, value: memberCmdHelp },
                        { name: prefix + statusUpdateCmd, value: statusUpdateCmdHelp },
                        { name: prefix + awayCmd, value: awayCmdHelp },
                        { name: prefix + registerCmd, value: registerCmdHelp }
	                )
	                .setTimestamp()
	                .setFooter({ text: 'Requested by: ' + message.author.tag, iconURL: message.author.displayAvatarURL() });

                await message.reply({
                    embeds: [helpEmbed]
                })

                // END
                break;
            
            case memberCmd:
                if (splitMessage.length <= 1) {
                    await message.reply("Please use the command with the following format: \`" + prefix + memberCmd + " [in-game username]\`")
                    return
                }
                
                const idFormatRegex = (/^(<@)[0-9]{18}>$/g)
                const idRegex = (/[<>@]/g)
                const idStatus = idFormatRegex.test(splitMessage[1])

                if (idStatus == true) {
                    const id = splitMessage[1].replace(idRegex, "")
                    const registerData = await isRegistered(id)
                    if (registerData == false) {
                        message.reply("User <@" + id + "> is not registered to any username on the sheets.")
                        return
                    } else {
                        splitMessage[1] = registerData[1]
                    }
                } 

                try {
                    let row = await memberRowSearch(splitMessage[1], message);
                    const characterNamesRed = await charSearch(redSheet, characters[0], splitMessage[1])
                    const characterNamesBlue = await charSearch(blueSheet, characters[1], splitMessage[1])
                    const characterNamesYellow = await charSearch(yellowSheet, characters[2], splitMessage[1])
                    const memCharNames = [characterNamesRed, characterNamesBlue, characterNamesYellow]
                    for (let i = 0; i < memCharNames.length; i++) {
                        if (memCharNames[i].length == 0) {
                            memCharNames[i].push("N/A")
                        }
                    }
                    let charEmbedRed = characterNamesRed.join("\n")
                    let charEmbedBlue = characterNamesBlue.join("\n")
                    let charEmbedYellow = characterNamesYellow.join("\n")
                
                    if (row.length == 0) {
                        await message.reply("Member \`" + splitMessage[1] + "\` not found.")
                        return
                    }
                    row = row[0]
                    if (row[2].length == 0 || row[2].trim().length < 1 || typeof row[2] === "undefined") {
                        row[2] = "N/A"
                    }
                    let username;
                    let avatarUrl;
                    try {
                        const user = await candyHouse.members.fetch(row[4])
                        username = user.user.username + "#" + user.user.discriminator
                        avatarUrl = user.displayAvatarURL()
                    } catch (err) {
                        username = "Unknown"
                        avatarUrl = "https://cdn.discordapp.com/avatars/1051475081370554419/558e8b7bc9228c99e7c4f431ed911e78.png?size=1024"
                        console.log("Discord user not found.")
                    }
                    const memberEmbed = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle(row[1])
                        .setThumbnail(avatarUrl)
                        .addFields(
                            { name: 'Status', value: row[2], inline: true },
                            { name: 'Join date', value: row[3].toString() + "\n", inline: true },
                            { name: 'Discord', value: username, inline: true },
                            { name: "\u200B", value: "\u200B"}
                        )
                        .addFields(
                            { name: '__**EXPLOSIVE**__', value: charEmbedRed, inline: true },
                            { name: '__**MYSTIC**__', value: charEmbedBlue, inline: true },
                            { name: '__**PIERCING**__', value: charEmbedYellow, inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Requested by ' + message.author.tag, iconURL: message.author.displayAvatarURL() })
                        
                    await message.reply({
                        embeds: [memberEmbed]
                    })
                } catch (err) {
                    console.log(err, "*")
                }

                // END
                break;

            case statusUpdateCmd:
                if (splitMessage.length < 3) {
                    await message.reply(
                        "Error: Not enough parameters. Please use the command as follows:" +
                        "\`" + prefix + statusUpdateCmd + " [member name] \"[update]\"\`"
                        )
                } else {
                    try {
                        const memberName = splitMessage[1]
                        let row = await memberRowSearch(memberName, message)
                        const index = row[1] + 3
                        row = row[0]
                        let msg = message.content.split("\"")
                        if (msg.length < 2 || message.content.slice(-1) !== "\"" || msg[1].length < 1 || message.content.split("\"")[1].trim().length < 1) {
                            await message.reply(
                                "Error. Please use the command with the following format:\n" +
                                "\`" + prefix + statusUpdateCmd + " [member name] \"status\"\`\n" +
                                "Please ensure that the status is encased with quotation marks (\")."
                            )
                            return
                        } else {
                            statusBox = "CandyHouse!D" + index
    
                            msg = msg[1]
                            await rowWrite(statusBox, [[msg]], "RAW")
                            await message.reply(
                                "Status for user \`" + row[1] + "\` successfully updated to:\n" +
                                "> " + msg
                            )
                            // Update member sheet
                            memberSheet = await googleSheets.spreadsheets.values.get({
                                auth,
                                spreadsheetId,
                                range: memberRange
                            })
                                                }
                    } catch (err) {
                        console.log(err)
                        return
                    }
                }

                // END
                break;

            case weaponStatusCmd:
                if (splitMessage.length < 3) {
                    await message.reply(
                        "Error: Not enough parameters.\n" + 
                        "Please use the command as follows: " +
                        "\`" + prefix + weaponStatusCmd + " [member name] [student name]\`"
                        )
                } else {
                    try {
                        let characterName = splitMessage[2]
                        const memberName = splitMessage[1]
                        
                        if (splitMessage.length > 3) {
                            const bracketTerm = getBracketTerm(message.content)
                            if (bracketTerm !== null) {
                                characterName = splitMessage[2] + " " + bracketTerm
                            }
                        }

                        characterName = characterName.toLowerCase()

                        if (typeof characterMap[characterName] === 'undefined') {
                            await message.reply("Character \`" + characterName + "\` not found.")
                            return
                        }

                        const characterNameRaw = characterMap[characterName][0]
                        const index = characterMap[characterName][1] + 1
                        const characterRange = characterMap[characterName][2]
                        
    
                        let row = await characterRowSearch(characterRange, memberName, message)
                        
                        if (typeof row !== "undefined"){
                            row = row[0]
                        } else {
                            return
                        }

                        if (index > row.length-1) {
                            await message.reply(
                                "Player \`" + row[0] + "\` does not own character \`" + characterNameRaw + "\`."
                            );
                        } else if (row[index].length != 0) {
                            await message.reply(
                                "Weapon status of character \`" + characterNameRaw + "\` belonging to player \`" + row[0] + "\`:\n" +
                                "> " + row[index]
                            )
                        } else {
                            await message.reply(
                                "Player \`" + row[0] + "\` does not own character \`" + characterNameRaw + "\`."
                            );
                        }
    
                    } catch(err) {
                        await message.reply(
                            "Whoops! An error occurred when doing command: " + message.content + ".\n" +
                            "Please contact <@" + process.env.GODSEL + "> regarding this issue."
                        )
                        console.log(err, "**")
                    }
                }

                // END
                break;

            case weaponUpdateCmd:
                if (splitMessage.length < 4) {
                    await message.reply(
                        "Error: Not enough parameters.\n" +
                        "Please use the command as follows:" +
                        "\`" + prefix + weaponUpdateCmd + " [member name] [student name] \"status\"\`"
                    );
                } else {
                    try {
                        let msg = message.content.split("\"")
                        let characterName = splitMessage[2]
                        let memberName = splitMessage[1]
                        
                        const bracketTerm = getBracketTerm(message.content)
                        if (bracketTerm !== null) {
                            characterName = splitMessage[2] + " " + bracketTerm
                        }
                        
                        characterName = characterName.toLowerCase()

                        if (msg.length < 2 || msg[1].length < 1 || message.content.charAt(message.content.length - 1) !== "\"") {
                            message.reply(
                                "Error. Please use the command with the following format:\n" +
                                "\`" + prefix + weaponUpdateCmd + " [member name] [student name] \"[status]\"\`\n" +
                                "Please ensure that the status is encased with quotation marks (\")."
                            )
                            return
                            
                        } else {
                            msg = msg[1]
    
                            if (typeof characterMap[characterName] === 'undefined') {
                                await message.reply("Character \`" + characterName + "\` not found.")
                                return
                            }
    
                            const characterNameRaw = characterMap[characterName][0]
                            const colIndex = characterMap[characterName][1] + 3
                            const characterRange = characterMap[characterName][2]
    
                            const rowData = await characterRowSearch(characterRange, memberName, message)
                            const playerNameRaw = rowData[0][0]
                            const rowIndex = rowData[1] + 4
                            const writeRange = characterRange.split("!")[0] + "!R" + rowIndex + "C" + colIndex
                            await rowWrite(writeRange, [[msg]], "RAW")
                            
                            await message.reply(
                                "Weapon status for character \`" + characterNameRaw + "\` belonging to player \`" + playerNameRaw + "\` successfully updated to:\n" +
                                "> " + msg
                            )
                            // Update character sheet depending on where the character belongs
                            switch (characterRange) {
                                case redRange:
                                    redSheet = await googleSheets.spreadsheets.values.get({
                                        auth,
                                        spreadsheetId,
                                        range: redRange
                                    })
                                    characterMap[characterName][3] = redSheet
                                    break;

                                case blueRange:
                                    blueSheet = await googleSheets.spreadsheets.values.get({
                                        auth,
                                        spreadsheetId,
                                        range: blueRange
                                    })
                                    characterMap[characterName][3] = blueSheet
                                    break;

                                case yellowRange:
                                    yellowSheet = await googleSheets.spreadsheets.values.get({
                                        auth,
                                        spreadsheetId,
                                        range: yellowRange
                                    })
                                    characterMap[characterName][3] = yellowSheet
                                    break;
                            }

                        }
                    } catch(err) {
                        console.log(err)
                    }
                }

                // END
                break;

            case investmentCmd:
                if (splitMessage.length < 2) {
                    await message.reply(
                        "Error: Not enough parameters. Please use the command as follows:\n" +
                        "\`" + prefix + investmentCmd + " [student name]\`"
                    );
                } else {
                    let characterName = splitMessage[1]
                    if (splitMessage.length > 2) {
                        const bracketTerm = getBracketTerm(message.content)
                        if (bracketTerm !== null) {
                            characterName += " " + bracketTerm
                        }
                    }
                    
                    characterName = characterName.toLowerCase()
                    
                    if (typeof characterMap[characterName] === 'undefined') {
                        await message.reply("Character \`" + characterName + "\` not found.")
                        return
                    }
                    
                    const characterNameRaw = characterMap[characterName][0]
                    const colIndex = characterMap[characterName][1] + 1
                    const characterSheet = characterMap[characterName][3]

                    investments = await investmentSearch(characterSheet, colIndex)
    
                    if (investments.length > 0) {
                        const msg = investments.join("\n")
        
                        await message.reply(
                            "Showing all member investments for character: \`" + characterNameRaw + "\`\n" +
                            msg
                        )
                    } else {
                        await message.reply(
                            "No member currently has investments in character \`" + characterNameRaw + "\`."
                        )
                    }
                }

                // END
                break;

            case awayCmd:
                const away = await awaySearch(memberRange)
                console.log(away)
                if (away.length > 0) {
                    let msg = ""
                    for (let i = 0; i < away.length; i++) {
                        if (away[i][1].trim().length > 1) {
                            msg += "> " + away[i][0] + ": \`" + away[i][1] + "\`\n"
                        }
                    }
    
                    await message.reply(
                        "Showing all members with \`Note\`:\n" +
                        msg 
                    )
                } else {
                    await message.reply(
                        "No members currently away."
                    )
                }

                // END
                break;

            case registerCmd:
                if (splitMessage.length < 2) {
                    await message.reply(
                        "Not enough parameters. Please use the command as follows:\n" +
                        "\`" + prefix + registerCmd + " [username]\`"
                    )
                    return
                } else {
                    memberName = splitMessage[1]
                    memberRow = await memberRowSearch(memberName, message)
                    if (typeof memberRow === "undefined" || memberRow.length == 0) {
                        await message.reply("Error: Member \`" + memberName + "\` not found.")
                        return
                    }
    
                    const registerResult = await register(memberName, message.author.id)
                    const registerStatus = registerResult[0]
                    const rawMemberName = registerResult[1]
                    if (registerStatus == true && rawMemberName.length > 0) {
                        await message.reply(
                            "Discord user <@" + message.author.id + "> successfully registered as " + "\`" + rawMemberName + "\`."
                        )
                    } else if (rawMemberName.length > 0) {
                        await message.reply(
                            "Registration failed!\n" +
                            "Discord user <@" + message.author.id + "> already registered as " + "\`" + rawMemberName + "\`.\n" /*+
                            "Please reset registration status with $reset, or contact an admin."*/
                        )
                        // Update memberSheet
                        memberSheet = await googleSheets.spreadsheets.values.get({
                            auth,
                            spreadsheetId,
                            range: memberRange
                        })
                    
                    } else {
                        await message.reply(
                            "Error."
                        )
                    }
                }

                // END
                break;
        }
    };
});

client.login(process.env.TOKEN);
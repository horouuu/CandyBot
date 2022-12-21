require("dotenv").config();
const {Client, GatewayIntentBits, discordSort, MessageManager, channelLink, Guild} = require("discord.js");
const {google} = require("googleapis");
const { EmbedBuilder } = require('discord.js');
const binomial = require('binomial')
const nodemon = require("nodemon");

const prefix = "$";
const spreadsheetId = process.env.SPREADSHEET;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers 
    ]
});

function getId(string) {
    const idFormatRegex = (/^(<@)[0-9]{18}>$/g)
    const idRegex = (/[<>@]/g)
    const idStatus = idFormatRegex.test(string)

    if (idStatus == false) {
        return null
    } else {
        return string.replace(idRegex, "")
    }
}

function getBracketTerm(string) {
    const bracketRegex = (/\(.[^\(]+\)/)
    let bracketTerm = string.match(bracketRegex)
    if (bracketTerm == null) {
        return null
    }
    
    bracketTerm = "(" + bracketTerm[0].replace(/[\)\()]/g, "").trim() + ")"
    const bracketTermLeft = bracketTerm.match(/^\(.+\s{1}/)
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
    return [false, id]
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
    const rowData = rows.data.values

    try {
        for (let i = 0; i < rowData.length; i++) {
            if (rowData[i][0].toLowerCase() === member.toLowerCase()) {
                return [rowData[i], i]
            }
        }
        return null

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
    await start() // Google sheets initialization, etc.

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


    // Slash commands initialization
    const testGuildId = process.env.NEETCAVE
    const testGuild = client.guilds.cache.get(testGuildId)

    let commands;

    if (testGuild) {
        commands = testGuild.commands
    } else {
        commands = client.application.commands
    }

    commands.create({
        name: "test",
        description: "testing"
    })

});


// Interaction responses 
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) {
        return
    }

    const { commandName, options } = interaction

    switch (commandName) {
        case "test":
            interaction.reply({
                content: "test",
                ephemeral: true
            })
    }
})

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
        const findRollsCmd = "rolls"
        

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
                "Write \`clear\` **without** quotation marks to clear their status instead.\n" +
                "\`" + prefix + statusUpdateCmd + " [username] \"status\"\`\n" +
                "\`" + prefix + statusUpdateCmd + " Coronne \"Finishing essays\"\`\n" +
                "\`" + prefix + statusUpdateCmd + " Coronne clear\`"

                const awayCmdHelp = 
                "Shows all members with a written \`Note\` on the Google Sheets.\n" +
                "\`" + prefix + awayCmd + "\`"

                const registerCmdHelp =
                "Registers your Discord ID to a Blue Archive username on the Google Sheets. \n" +
                "\`" + prefix + registerCmd + " [username]\`\n" +
                "\`" + prefix + registerCmd + " Coronne" + "\`"

                const findRollsCmdHelp =
                "Finds how many rolls it takes to guarantee a certain chance of getting at least \`n\` featured/spook characters.\n" +
                "\`" + prefix + findRollsCmd + " [number] [type] [chance]\`\n" +
                "\`" + prefix + findRollsCmd + " 3 featured 90%\`\n" +
                "\`" + prefix + findRollsCmd + " 2 spook 0.5\`"

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
                        { name: prefix + registerCmd, value: registerCmdHelp },
                        { name: prefix + findRollsCmd, value: findRollsCmdHelp}
	                )
	                .setTimestamp()
	                .setFooter({ text: 'Requested by: ' + message.author.tag, iconURL: message.author.displayAvatarURL() });

                await message.reply({
                    embeds: [helpEmbed]
                })

                // END
                break;
            
            // Member
            case memberCmd:
                if (splitMessage.length <= 1) {
                    await message.reply("Please use the command with the following format: \`" + prefix + memberCmd + " [in-game username]\`")
                    return
                }
                
                // 1st parameter ID check
                let memberName = splitMessage[1]

                const idData = getId(memberName)
                if (idData != null) {
                    const registerData = await isRegistered(idData)
                    if (registerData[0] == false) {
                        message.reply("User <@" + registerData[1] + "> is not registered to any username on the sheets.")
                        return
                    } else {
                        memberName = registerData[1]
                    }
                } 

                // Try-catch block to ensure bot doesn't crash if any errors occur here
                try {

                    // Check if member exists
                    let memberRow = await memberRowSearch(memberName, message);
                    if (memberRow.length == 0) {
                        await message.reply("Member \`" + memberName + "\` not found.")
                        return
                    }

                    // Find all characters with valid entries in member's row
                    const characterNamesRed = await charSearch(redSheet, characters[0], memberName)
                    const characterNamesBlue = await charSearch(blueSheet, characters[1], memberName)
                    const characterNamesYellow = await charSearch(yellowSheet, characters[2], memberName)
                    const memCharNames = [characterNamesRed, characterNamesBlue, characterNamesYellow]
                    for (let i = 0; i < memCharNames.length; i++) {
                        if (memCharNames[i].length == 0) {
                            memCharNames[i].push("N/A")
                        }
                    }
                    let charEmbedRed = characterNamesRed.join("\n")
                    let charEmbedBlue = characterNamesBlue.join("\n")
                    let charEmbedYellow = characterNamesYellow.join("\n")
                    
                    
                    memberRow = memberRow[0]
                    if (memberRow[2].length == 0 || memberRow[2].trim().length < 1 || typeof memberRow[2] === "undefined") {
                        memberRow[2] = "Available"
                    }
                    let username;
                    let avatarUrl;
                    try {
                        const user = await candyHouse.members.fetch(memberRow[4])
                        username = user.user.username + "#" + user.user.discriminator
                        avatarUrl = user.displayAvatarURL()
                    } catch (err) {
                        username = "Unknown"
                        avatarUrl = "https://cdn.discordapp.com/avatars/1051475081370554419/558e8b7bc9228c99e7c4f431ed911e78.png?size=1024"
                        console.log("Discord user not found.")
                    }
                    const memberEmbed = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle(memberRow[1])
                        .setThumbnail(avatarUrl)
                        .addFields(
                            { name: 'Status', value: memberRow[2], inline: true },
                            { name: 'Join date', value: memberRow[3].toString() + "\n", inline: true },
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

            // Status update
            case statusUpdateCmd:
                if (splitMessage.length < 3) {
                    await message.reply(
                        "Not enough parameters. Please use the command as follows:\n" +
                        "\`" + prefix + statusUpdateCmd + " [member name] \"[update]\"\`"
                        )
                } else if (splitMessage[2].toLowerCase() === "clear") {  // Code block for "clear" command.

                    // 1st parameter ID check
                    let memberName = splitMessage[1]

                    const idData = getId(memberName)
                    if (idData != null) {
                        const registerData = await isRegistered(idData)
                        if (registerData[0] == false) {
                            message.reply("User <@" + registerData[1] + "> is not registered to any username on the sheets.")
                            return
                        } else {
                            memberName = registerData[1]
                        }
                    }

                    let memberRow = await memberRowSearch(memberName, message)

                    if (memberRow.length == 0) {
                        await message.reply("Member \`" + memberName + "\` not found.")
                        return
                    }

                    const index = memberRow[1] + 3
                    memberRow = memberRow[0]

                    statusBox = "CandyHouse!D" + index
                    await rowWrite(statusBox, [[""]], "RAW")

                    message.reply("Successfully cleared status for user \`" + memberName + "\`.")

                    // Update member sheet
                    memberSheet = await googleSheets.spreadsheets.values.get({
                        auth,
                        spreadsheetId,
                        range: memberRange
                    })
                } else {

                    try { // Try-catch to ensure bot stays alive

                        // 1st parameter ID check
                        let memberName = splitMessage[1]

                        const idData = getId(memberName)
                        if (idData != null) {
                            const registerData = await isRegistered(idData)
                            if (registerData[0] == false) {
                                message.reply("User <@" + registerData[1] + "> is not registered to any username on the sheets.")
                                return
                            } else {
                                memberName = registerData[1]
                            }
                        }

                        // Check if member exists
                        let memberRow = await memberRowSearch(memberName, message)
                        const index = memberRow[1] + 3
                        memberRow = memberRow[0]
                        let msg = message.content.split("\"")
                        if (msg.length < 2 || message.content.slice(-1) !== "\"" || msg[1].length < 1 || message.content.split("\"")[1].trim().length < 1) {
                            await message.reply(
                                "Please use the command with the following format:\n" +
                                "\`" + prefix + statusUpdateCmd + " [member name] \"status\"\`\n" +
                                "Please ensure that the status is encased with quotation marks (\")."
                            )
                            return
                        } else {
                            statusBox = "CandyHouse!D" + index
    
                            msg = msg[1]
                            await rowWrite(statusBox, [[msg]], "RAW")
                            await message.reply(
                                "Status for user \`" + memberRow[1] + "\` successfully updated to:\n" +
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
                    
                    // Ensures bot doesn't crash on error
                    try {
                        let characterName = splitMessage[2]
                        
                        // 1st parameter ID check
                        let memberName = splitMessage[1]
                        const idData = getId(memberName)
                        if (idData != null) {
                            const registerData = await isRegistered(idData)
                            if (registerData[0] == false) {
                                message.reply("User <@" + registerData[1] + "> is not registered to any username on the sheets.")
                                return
                            } else {
                                memberName = registerData[1]
                            }
                        }

                        if (splitMessage.length > 3) {
                            const bracketTerm = getBracketTerm(message.content)
                            if (bracketTerm !== null) {
                                characterName = splitMessage[2] + " " + bracketTerm
                            }
                        }

                        // Check if character exists
                        characterName = characterName.toLowerCase()
                        if (typeof characterMap[characterName] === 'undefined') {
                            await message.reply("Character \`" + characterName + "\` not found.")
                            return
                        }

                        const characterNameRaw = characterMap[characterName][0]
                        const index = characterMap[characterName][1] + 1
                        const characterRange = characterMap[characterName][2]
                        
                        // Check if member exists
                        let row = await characterRowSearch(characterRange, memberName, message)
                        if (row != null){
                            row = row[0]
                        } else {
                            await message.reply("Member \`" + memberName + "\` not found.")
                            return
                        }

                        // Check if member has character
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

                        // 1st parameter ID check
                        let memberName = splitMessage[1]
                        const idData = getId(memberName)
                        if (idData != null) {
                            const registerData = await isRegistered(idData)
                            if (registerData[0] == false) {
                                message.reply("User <@" + registerData[1] + "> is not registered to any username on the sheets.")
                                return
                            } else {
                                memberName = registerData[1]
                            }
                        }
                        
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
                            if (rowData == null) {
                                await message.reply("Member \`" + memberName + "\` not found.")
                                return
                            }

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



            // Find rolls command
            case findRollsCmd:
                
                if (splitMessage.length == 4) {
                    
                    // Check and validate [number] input
                    let pullRate;
                    let desiredNumber = splitMessage[1]
                    desiredNumber = parseInt(desiredNumber)
                    if (isNaN(desiredNumber)) {
                        message.reply("\`" + splitMessage[1] + "\` is not a valid integer.")
                    } else if (desiredNumber > 100) {
                        message.reply(
                            "Uh-oh! You've entered a number above 100!\n" +
                            "What do you need all those characters for?"
                        )
                        return
                    }

                    let featuredStatus = splitMessage[2]
                    featuredStatus = String(featuredStatus)
                    if (featuredStatus === "featured") {
                        pullRate = 0.007
                    } else if (featuredStatus === "spook") {
                        pullRate = 0.0005
                    } else {
                        message.reply(
                            "\`" + splitMessage[2] + "\` is not a valid character type.\n" +
                            "You can choose between \`featured\` or \`spook\`."
                        )
                    }

                    // Check for percentage input
                    let desiredRate = splitMessage[3]
                    if ((/[%]$/g).test(desiredRate) == true) {
                        desiredRate = desiredRate.replace(/[%]$/g, "")
                        desiredRate = parseInt(desiredRate)/100
                    }
                    
                    if (isNaN(desiredRate)) {
                        message.reply("`" + splitMessage[3] + "` is not a valid probability.")
                        return
                    } else if (desiredRate >= 1 || desiredRate <= 0) {
                        message.reply("You cannot input a probability below 0% or above 100%!")
                        return
                    } else {
                        let n = desiredNumber;
                        let rate = 0;
                        while (rate < desiredRate) {
                            rate = 1
                            for (let k = 0; k < desiredNumber; k++) {
                                rate -= binomial.get(n, k)*(pullRate**k)*( (1-pullRate)**(n-k) )
                            }
                            n += 1
                        }
                        
                        desiredRate = String(desiredRate*100) + "%"
                        message.reply(
                            "You need to roll \`at least " + n + " times\` in order to guarantee a \`" + desiredRate + " chance\` of rolling " +
                            "\`at least " + desiredNumber + "\` " + featuredStatus + " characters."
                        )
                    }
                }

                // END
                break;
        }
    };
});

client.login(process.env.TOKEN);
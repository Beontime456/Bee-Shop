// Require the necessary classes for the bot to function
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');

// Create a new client instance
const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    ], allowedMentions: { repliedUser: false } });

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        // Set a new item in the Collection with the key as the command name and the value as the exported module
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        }
        else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

// Initialise all functions and required tables from universal module
const { playerinformation, playerbees, beelist, calculateAllBees, calculateLevelUp } = require('./universalmodule.js');

playerinformation.sync();
playerbees.sync();
beelist.sync();

// Initialise a prefix for the bot to see message commands
const prefix = 'bs ';

// IMPORTANT FUNCTION - Run all messageCreate and interaction commands through this function.
async function concurrencyMiddleware(interactionOrMessage, next) {
    const isSlash = interactionOrMessage.isCommand?.();
    const user = isSlash ? interactionOrMessage.user : interactionOrMessage.author;

    if (usersInCommand.has(user.id)) {
        if (!isSlash) {
            interactionOrMessage.reply('You are already executing a command! Finish the previous command first.');
            return;
        }
        else if (isSlash) {
            interactionOrMessage.reply('You are already executing a command! Finish the previous command first.');
            return;
        }
    }
    usersInCommand.add(user.id);

    if (isSlash) {
        await interactionOrMessage.deferReply();
    }
    await next();

    const findPlayerXp = await playerinformation.findOne({ where: { playerid: user.id }, attributes: ['playerid', 'level', 'playerXp'] });
    if (findPlayerXp) {
        const levelsGained = await calculateLevelUp(findPlayerXp);
        if (levelsGained > 0) { await interactionOrMessage.channel.send(`${user.displayName} levelled up ${levelsGained} time(s)! They gained +${levelsGained} coins/message!`); }
    }

    usersInCommand.delete(user.id);
}

// When the client is ready, run this code (only once)
// We use 'c' for the event parameter to keep it separate from the already defined 'client'
client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
});

const usersInCommand = new Set();

client.on(Events.InteractionCreate, async interaction => {

    if (!interaction.guild) { return interaction.reply('DM commands are not supported.'); }

    const findplayer = await playerinformation.findOne({ where: { playerid: interaction.user.id } });

    if (interaction.isAutocomplete()) {
        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        if (!command.autocomplete) return console.error(`No autocomplete handler was found for the ${interaction.commandName} command.`);

        try {
            await command.autocomplete(interaction);
        }
        catch (error) {
            console.error(error);
        }
    }
    if (interaction.isChatInputCommand()) {
        const command = await interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        // Start - This is the easiest to maintain workaround I could think of for when a player hasn't started but wants to execute a command
        if (findplayer === null && interaction.commandName != 'start') { return interaction.reply('You haven\'t started yet! Use `/start` to start!'); }

        const responseMethod = interaction.followUp.bind(interaction);

        try {
            concurrencyMiddleware(interaction, async () => { await command.execute(responseMethod, interaction, true, [], client); });
        }
        catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: `There was an error while executing this command! ${error.name}: ${error.message}` });
            }
            else {
                await interaction.reply({ content: `There was an error while executing this command! ${error.name}: ${error.message}` });
            }
        }
    }
});

// When the bot sees a message, it will analyse it for a prefix or if the sender is a bot.
// If the keyword after the prefix is a word in a command it will execute that specific command.
client.on(Events.MessageCreate, async (message) => {
    try {

        if (message.author.bot) return;

        // Check to see if the player has sent a message that doesn't use the prefix.
        const findplayer = await playerinformation.findOne({ where: { playerid: message.author.id } });
        if (!message.content.toLowerCase().startsWith(prefix)) {
            // Run several checks at once to see if the player is eligible for gaining coins and xp in their message
            // The requirements are that the player must have completed start, they are not currently in a command like hangman, and they cannot have sent an eligible message in the last 2 seconds.
            if (!findplayer || usersInCommand.has(message.author.id) || Date.now() - findplayer.get('lastMessage') < 2000) return;

            // Pull the amount of coins and xp they gain and increase that using factors like levels and xp.
            const { coins, xp } = await calculateAllBees(message.author);
            const moneyGained = coins * (1 + 0.2 * findplayer.get('prestiges')) + findplayer.get('level');
            const xpGained = xp * (1 + 0.05 * findplayer.get('prestiges'));

            // Update the player's data to include the now increased coin and xp amounts, along with the time of the most recently sent eligible message.
            await findplayer.update({ money: Math.floor(findplayer.get('money') + moneyGained), lastMessage: Date.now(), playerXp: Math.floor(findplayer.get('playerXp') + xpGained) });

            // Check if the player has levelled up as a result of this xp gain.
            const levelsGained = await calculateLevelUp(findplayer);
            if (levelsGained > 0) { await message.reply(`${message.author.displayName} levelled up ${levelsGained} time(s)! They gained +${levelsGained} coins/message!`); }
            return;
        }

        // Split the arguments of a command and take the actual command from the arguments.
        const args = message.content.slice(prefix.length).split(/\s+/);
        const command = args.shift().toLowerCase();

        // Find the command in the command files.
        const slashCommand = await client.commands.get(command);

        const responseMethod = message.reply.bind(message);

        // Start - This is the easiest to maintain workaround I could think of for when a player hasn't started but wants to execute a command
        if (command === 'start') {
            concurrencyMiddleware(message, async () => { await slashCommand.execute(responseMethod, message, false, args, client); });
            return;
        }

        if (!findplayer) { return message.reply('You haven\'t started yet! Use `bs start` to start.'); }

        // If the command exists, attempt to execute it as a text command with the supplied args (and the client in case the client needs to be called)
        if (slashCommand) {
            concurrencyMiddleware(message, async () => { await slashCommand.execute(responseMethod, message, false, args, client); });
            return;
        }

        // Any commands below this point will be abbreviations for text based commands (e.g bee profile abbreviated to bee p) OR the text-exclusive tester commands.
        // Make sure the abbreviation calls the correct command

        if (command === 'p' || command === 'pr') {
            concurrencyMiddleware(message, async () => { await client.commands.get('profile').execute(responseMethod, message, false, args, client); });
            return;
        }

        else if (command === 'cf') {
            concurrencyMiddleware(message, async () => { await client.commands.get('coinflip').execute(responseMethod, message, false, args, client); });
            return;
        }

        // Master Commands - Tester Commands ONLY
        // These are the set of commands that remain exclusive to prefix only - DO NOT port to slash
        else if (command === 'mc') {
            try {
                if (message.member.roles.cache.some(role => role.id === '1204273392434548756') || message.author.id === '595411220476067860') {
                        let lastArg = parseInt(args[args.length - 1]);
                        if (typeof lastArg === 'number' && Number.isNaN(lastArg) != true) {
                            args.pop();
                        }
                        else {
                            lastArg = 1;
                        }
                        if (args[0] === 'gift') {
                            await findplayer.update({ money: findplayer.get('money') + lastArg });
                            await message.channel.send(`You were given ${lastArg} money!`);
                        }
                        else if (args[0] === 'prestige') {
                            await findplayer.update({ prestiges: findplayer.get('prestiges') + lastArg });
                            await message.channel.send(`Your prestiges have been magically increased by ${lastArg}!`);
                        }
                        else if (args[0] === 'expand') {
                            await findplayer.update({ beeSlots: findplayer.get('beeSlots') + lastArg });
                            await message.channel.send(`Your space for bees has expanded by ${lastArg}!`);
                        }
                        else if (args[0] === 'level') {
                            await findplayer.update({ level: findplayer.get('level') + lastArg });
                            await message.channel.send(`Your levels have been increased by ${lastArg}!`);
                        }
                }
            }
            catch (error) {
                await message.channel.send(`There was an error! ${error.name}: ${error.message}`);
                console.log(error);
            }
        }
    }
    catch (error) {
        await message.reply(`There was an error! ${error.name}: ${error.message}`);
        console.log(error);
    }
});

// Log in to Discord with your client's token
client.login(token);
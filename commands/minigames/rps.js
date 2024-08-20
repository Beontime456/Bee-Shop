const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

// Initialise all functions and required tables from universal module
const {
    playerinformation,
    beeFact,
    interactionAuthFunc,
} = require('C:/Bee Shop/universalmodule.js');

playerinformation.sync();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('rps')
		.setDescription('Play Rock Paper Scissors against the bot.')
        .addIntegerOption(option =>
            option.setName('money')
                .setDescription('How much money to bet.')
                .setRequired(true),
        ),
    async execute(responseMethod, interaction, isSlash, args) {
        // Determine command execution type and therefore where arguments are stored
        const interactionAuth = await interactionAuthFunc(isSlash, interaction);
        const amountOfMoney = isSlash ? interaction.options.getInteger('money') : parseInt(args[0]);
        // Make sure arguments pass checks
        if (isNaN(amountOfMoney)) { return responseMethod('You must specify an amount of money!'); }
        const findplayer = await playerinformation.findOne({ where: { playerid: interactionAuth.id } });
        if (findplayer.get('money') < amountOfMoney) { return responseMethod('You don\'t have enough money for the bet!'); }
        if (amountOfMoney < 0) { return responseMethod('You need to bet at least 0 money or more!'); }
        // Create the buttons, embed, and message
        const row = new ActionRowBuilder()
            .addComponents([
                new ButtonBuilder()
                    .setCustomId('rock')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🪨'),
                new ButtonBuilder()
                    .setCustomId('paper')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📰'),
                new ButtonBuilder()
                    .setCustomId('scissors')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✂'),
            ]);
        const rpsEmbed = new EmbedBuilder()
            .setColor(0xffe521)
            .setAuthor({ name: `${interactionAuth.displayName}'s Rock Paper Scissors`, iconURL: interactionAuth.displayAvatarURL() })
            .setFooter({ text: beeFact() })
            .setFields({ name: 'Rock Paper Scissors', value: 'Pick between rock, paper, or scissors and see what the bot chose.' });
        const rpsMessage = await responseMethod({ embeds: [rpsEmbed], components: [row] });
        // Create the game and wait for the user to choose.
        const rpsArray = ['rock', 'paper', 'scissors'];
        const collectorFilter = i => {
            i.deferUpdate();
            return i.user.id === interactionAuth.id;
        };
        await rpsMessage.awaitMessageComponent({ filter: collectorFilter, time: 30000 })
        // What happens when a button press makes it past the filter
        .then(async i => {
            // Once the user has chosen, let the bot pick randomly and compare it to the user's choice to determine the outcome
            const botChoice = rpsArray[Math.floor(Math.random() * 3)];
            const userChoice = i.customId;
            if (userChoice === botChoice) {
                rpsMessage.edit({ embeds: [], components: [], content: `Bot chose ${botChoice}. It's a tie!` });
            }
            else if ((userChoice === 'rock' && botChoice === 'scissors') ||
                (userChoice === 'scissors' && botChoice === 'paper') ||
                (userChoice === 'paper' && botChoice === 'rock')) {
                rpsMessage.edit({ embeds: [], components: [], content: `Bot chose ${botChoice}. You won ${Math.floor(amountOfMoney * 1.5)} money!` });
                await findplayer.update({ money: Math.floor(findplayer.get('money') + amountOfMoney * 1.5) });
            }
            else {
                rpsMessage.edit({ embeds: [], components: [], content: `Bot chose ${botChoice}. You lose and hand over ${amountOfMoney} money.` });
                await findplayer.update({ money: Math.floor(findplayer.get('money') - amountOfMoney) });
            }

        })
        // What happens if the collector receives no button press that makes it past the filter
        .catch(() => {
            row.components.forEach(button => button.setDisabled(true));
            rpsMessage.edit({ components: [row] });
        });
    },
};
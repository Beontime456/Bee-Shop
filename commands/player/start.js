// Dependencies for command
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

// Initialise all functions and required tables from universal module
const {
    playerinformation,
    interactionAuthFunc,
} = require('C:/Bee Shop/universalmodule.js');

playerinformation.sync();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('start')
		.setDescription('Begin your journey.'),
	async execute(responseMethod, interaction, isSlash) {
        // Identify if a command was initiated through slash or text.
        const interactionAuth = await interactionAuthFunc(isSlash, interaction);
        // Attempt to load player data and act accordingly
        const findplayer = await playerinformation.findOne({ where: { playerid: interactionAuth.id } });
        if (findplayer) { return responseMethod('Oops, it appears you already have started!'); }
        // Initialise the button, embed, collector filter, message, and the collector
        const row = new ActionRowBuilder()
        .addComponents([
            new ButtonBuilder()
                .setCustomId('confirm')
                .setLabel('Agree')
                .setStyle(ButtonStyle.Success),
        ]);
        const confirmembed = new EmbedBuilder()
            .setColor(0xb36e07)
            .setFooter({ text: 'Failure to abide by the rules can result in punishment.' })
            .addFields({ name: 'Welcome to Bee Shop!', value: 'Bee Shop Rules: \n\nPlaceholder \n\nBy clicking \'Agree\' you agree to the rules as stated above.' });
        const confirmMessage = await responseMethod({ embeds: [confirmembed], components: [row] });
        const collectorFilter = i => {
            i.deferUpdate();
            return i.user.id === interactionAuth.id;
        };
        await confirmMessage.awaitMessageComponent({ filter: collectorFilter, time: 30000 })
        // What happens when a button press makes it past the filter
        .then(async i => {
            if (i.customId === 'confirm') {
                await playerinformation.create({
                    playerid: interactionAuth.id,
                    money: 500,
                    lastMessage: Date.now(),
                    prestiges: 0,
                    beeSlots: 6,
                });
                await confirmMessage.edit({ content: 'Congrats, you have now started!', embeds: [], components: [] });
                return;
            }
        })
        // What happens if the collector receives no button press that makes it past the filter
        .catch(() => {
            row.components.forEach(button => button.setDisabled(true));
            confirmMessage.edit({ components: [row] });
        });
    },
};
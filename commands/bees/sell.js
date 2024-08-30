// Required dependencies
const { SlashCommandBuilder, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Initialise all functions and required tables from universal module
const {
    playerinformation,
    playerbees,
    beelist,
    beeFact,
    capitaliseWords,
    interactionAuthFunc,
    requestBeeFunc,
} = require('C:/Bee Shop/universalmodule.js');

playerinformation.sync();
playerbees.sync();
beelist.sync();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('sell')
		.setDescription('Sell one of your own bees')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The player-given name of the bee you want to sell')
                .setRequired(true)
                .setAutocomplete(true),
        ),
    async autocomplete(interaction) {
        // Autocomplete will show a series of results from both the items and bees tables depending on what you type in the name arg. Only through slash.
        const focusedOption = interaction.options.getFocused(true);
        const choices = [];
        const sellChoices = await playerbees.findAll({ where: { playerid: interaction.user.id } });
        for (let count = 0; count < sellChoices.length; count++) {
            choices.push(sellChoices.get('beeName'));
        }

        // Filters the options and feeds them to Discord to feed the player.
        const filtered = choices.filter(choice => choice.startsWith(focusedOption.value.toLowerCase()));
        let options;
        if (filtered.length > 25) {
            options = filtered.slice(0, 25);
        }
        else {
            options = filtered;
        }
        await interaction.respond(
            options.map(choice => ({ name: capitaliseWords(choice), value: choice })),
        );
    },
	async execute(responseMethod, interaction, args) {
        // Determine command execution type and therefore where arguments are stored
        const interactionAuth = await interactionAuthFunc(interaction);
        const requestbee = await requestBeeFunc(interaction, args);
        // Find the player and find their bee with the name supplied
        const findplayer = await playerinformation.findOne({ where: { playerid: interactionAuth.id } });
        const findBee = await playerbees.findOne({ where: { beeName: requestbee, playerid: interactionAuth.id } });
        // Should the bee be found, retrieve it's price that it can be bought for
        if (findBee === null) { return responseMethod('There isn\'t a bee named this that you own!'); }
        const findBeePrice = await beelist.findOne({ where: { beeid: findBee.get('beeid') } });
        const row = new ActionRowBuilder()
            .addComponents([
                new ButtonBuilder()
                    .setCustomId('confirm')
                    .setLabel('Yes')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('deny')
                    .setLabel('No')
                    .setStyle(ButtonStyle.Danger),
            ]);
        // Proceed to generate embed, buttons, and button listener
        const confirmembed = new EmbedBuilder()
            .setColor(0xffe521)
            .setAuthor({ name: `${interactionAuth.displayName}`, iconURL: interactionAuth.displayAvatarURL() })
            .setFooter({ text: beeFact() })
            .addFields({ name: `Are you sure you want to sell ${capitaliseWords(requestbee)}?`, value: `If you sell this bee you will receive ${findBeePrice.get('beePrice') / 2} money.` });
        const confirmMessage = await responseMethod({ embeds: [confirmembed], components: [row] });
        const collectorFilter2 = i => { return i.user.id === interactionAuth.id; };
        await confirmMessage.awaitMessageComponent({ filter: collectorFilter2, time: 15000 })
        // What happens when a button press makes it past the filter
        .then(async j => {
            if (j.customId === 'confirm') {
                    await confirmMessage.edit({ content: `Sold ${capitaliseWords(findBee.get('beeName'))} for ${findBeePrice.get('beePrice') / 2} money!`, embeds: [], components: [] });
                    await findplayer.update({ money: findplayer.get('money') + findBeePrice.get('beePrice') / 2 });
                    await playerbees.destroy({ where: { beeName: requestbee, playerid: interactionAuth.id } });
                }
            else if (j.customId === 'deny') {
                confirmMessage.edit({ components: [], embeds: [], content: 'You decided not to sell your bee.' });
            }
        })
        // What happens if the collector receives no button press that makes it past the filter
        .catch((error) => {
            console.log(error);
            row.components.forEach(button => button.setDisabled(true));
            confirmMessage.edit({ components: [row] });
        });
    },
};
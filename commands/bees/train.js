const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

// Initialise all functions and required tables from universal module
const {
    playerinformation,
    playerbees,
    beelist,
    beeFact,
    requestBeeFunc,
    interactionAuthFunc,
} = require('C:/Bee Shop/universalmodule.js');

playerinformation.sync();
playerbees.sync();
beelist.sync();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('train')
		.setDescription('Spend some money to increase your bee\'s levels')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The name of the bee you want to train')
                .setRequired(true)
                .setAutocomplete(true),
        ),
    async autocomplete(interaction) {
        // Autocomplete will show a series of results from both the items and bees tables depending on what you type in the name arg. Only through slash.
        const focusedOption = interaction.options.getFocused(true);
        const choices = [];
        const allBees = await playerbees.findAll({ where: { playerid: interaction.user.id } });
        for (let count = 0; count < allBees.length; count++) {
            choices.push(allBees[count].dataValues.beeName);
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
            options.map(choice => ({ name: choice, value: choice })),
        );
    },
	async execute(responseMethod, interaction, isSlash, args) {
        // Determine command execution type and therefore where arguments are stored
        const requestbee = await requestBeeFunc(isSlash, interaction, args);
        const interactionAuth = await interactionAuthFunc(isSlash, interaction);

        // Find the bee they are referring to and check if it exists.
        const findBee = await playerbees.findOne({ where: { beeName: requestbee, playerid: interactionAuth.id } });
        if (findBee === null) { return responseMethod('You don\'t have a bee named this!'); }

        // Prompt the player to give the amount of times to train the bee, and compare it to the bee's level.
        const nameMessage = await responseMethod(`How many times do you want to train ${requestbee}?`);
        const collectorFilter = (response) => response.author.id === interactionAuth.id;
        interaction.channel.awaitMessages({ filter: collectorFilter, time: 30000, max: 1, errors: ['time'] })
        .then(async (response) => {
            const findBeeIncrease = await beelist.findOne({ where: { beeid: findBee.get('beeid') } });
            const findplayer = await playerinformation.findOne({ where: { playerid: interactionAuth.id } });
            let totalMoney = 0;
            const lastArg = parseInt(response.first());
            if (!isNaN(lastArg)) { args.pop();}
            else { return response.first().reply('You must specify a number!'); }
            if (findBee.get('beeLevel') + lastArg > Math.floor(findBeeIncrease.get('levelCapMultiplier') * 10 * (0.1 * findplayer.get('prestiges') + 1))) { return response.first().reply('Traning your bee this much would put it over the level limit.'); }
            for (let count = findBee.get('beeLevel'); count < findBee.get('beeLevel') + lastArg; count++) { totalMoney += Math.floor((50 * count) * (findBeeIncrease.get('beeBaseIncrease') / 1.33) + 100); }
            if (findplayer.get('money') < totalMoney) { return response.first().reply(`You're too poor for this! You need ${totalMoney - findplayer.get('money')} more money!`); }

            // Create the buttons to confirm if the player wants to train the bee.
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
            const confirmembed = new EmbedBuilder()
                .setColor(0xffe521)
                .setAuthor({ name: `${interactionAuth.displayName}'s training`, iconURL: interactionAuth.displayAvatarURL() })
                .setFooter({ text: beeFact() })
                .addFields({ name: `Are you sure you want to train ${requestbee}?`, value: `Training ${requestbee} ${lastArg} time(s) will cost ${totalMoney} money. \n\nDo you want to train your bee?` });
            const confirmMessage = await responseMethod({ embeds: [confirmembed], components: [row] });
            const collectorFilter2 = i => {
                i.deferUpdate();
                return i.user.id === interactionAuth.id;
            };
            await confirmMessage.awaitMessageComponent({ filter: collectorFilter2, time: 30000 })

            // What happens when a button press makes it past the filter
            .then(async i => {
                if (i.customId === 'confirm') {
                    await findplayer.update({ money: findplayer.get('money') - totalMoney });
                    await findBee.update({ beeLevel: findBee.get('beeLevel') + lastArg });
                    confirmMessage.edit({ components: [], embeds: [], content: `You trained ${requestbee} for ${totalMoney} money!` });
                }
                else if (i.customId === 'deny') {
                    confirmMessage.edit({ components: [], embeds: [], content: 'You decided not to train your bee.' });
                }
            })

            // What happens if the collector receives no button press that makes it past the filter
            .catch(() => {
                row.components.forEach(button => button.setDisabled(true));
                confirmMessage.edit({ components: [row] });
            });
        })
        .catch(async (error) => {
            await nameMessage.edit('You decided not to train your bee.');
            console.log(error);
        });
    },
};
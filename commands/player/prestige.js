// Dependencies for command
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Sequelize } = require('sequelize');

// Initialise all functions and required tables from universal module
const {
    playerinformation,
    playerbees,
    beelist,
    beeFact,
    calculateAllBees,
    capitaliseWords,
    interactionAuthFunc,
} = require('C:/Bee Shop/universalmodule.js');

playerinformation.sync();
playerbees.sync();
beelist.sync();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('prestige')
		.setDescription('Prestige, clearing your bees and money but providing bonuses.'),
	async execute(responseMethod, interaction) {
        try {
            // Checks if the command was initiated through slash or text.
            const interactionAuth = await interactionAuthFunc(interaction);
            const findplayer = await playerinformation.findOne({ where: { playerid: interactionAuth.id } });
            let prestigeEmbed = undefined;
            const prestigeLevelReq = Math.floor(20 * Math.pow(1.2, (findplayer.get('prestiges') + 1)));
            const prestigeMoneyReq = Math.floor(500 * Math.pow(1.2, (findplayer.get('prestiges') + 1)));
            if (findplayer.get('level') < prestigeLevelReq || findplayer.get('money') < prestigeMoneyReq) {
                prestigeEmbed = new EmbedBuilder()
                    .setColor(0xffe521)
                    .setFooter({ text: beeFact() })
                    .setFields({ name: 'You don\'t meet the requirements to prestige', value: `You don't meet the requirements to prestige yet! \n\nLevels needed: ${findplayer.get('level')}/${prestigeLevelReq} \nMoney needed: ${findplayer.get('money')}/${prestigeMoneyReq}` });
                await responseMethod({ embeds: [prestigeEmbed] });
                return;
            }
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
            let text = '';
            const { prestiges } = await calculateAllBees(interactionAuth);
            const newPrestigeCount = findplayer.get('prestiges') + prestiges;
            const findPrestigeBees = await beelist.findAll({ where: { prestigeReq: { [Sequelize.Op.lte]: findplayer.get('prestiges') + prestiges, [Sequelize.Op.gt]: 0 } } });
            for (const bee of findPrestigeBees) {
                text += `Unlock ${capitaliseWords(bee.get('beeName'))} in the shop\n`;
            }
            prestigeEmbed = new EmbedBuilder()
                .setColor(0xffe521)
                .setFooter({ text: beeFact() })
                .setFields({ name: 'Are you sure you want to prestige?', value: `If you prestige, you will lose all your money, bees and levels, but you will also gain rewards to help you! \n\nPrestiging now would give you ${prestiges} prestige(s) and the following bonuses: \n\nx${(1 + 0.2 * newPrestigeCount).toFixed(1)} bonus on almost any money gained \nx${(1 + 0.05 * newPrestigeCount).toFixed(2)} bonus on almost any XP gained \n+${1 * newPrestigeCount} extra bee slot(s) \nx${(1 + 0.1 * newPrestigeCount).toFixed(1)} higher level caps on bees \n\n${text}` });
            const prestigeMessage = await responseMethod({ embeds: [prestigeEmbed], components: [row] });
            const collectorFilter = i => {
                i.deferUpdate();
                return i.user.id === interactionAuth.id;
            };
            await prestigeMessage.awaitMessageComponent({ filter: collectorFilter, time: 30000 })
            // What happens when a button press makes it past the filter
            .then(async i => {
                if (i.customId === 'confirm') {
                    await playerbees.destroy({ where: { playerid: interactionAuth.id } });
                    await findplayer.update({ prestiges: findplayer.get('prestiges') + prestiges, money: 500, beeslots: findplayer.get('beeSlots') + prestiges, level: 0, playerXp: 0 });
                    prestigeMessage.edit({ components: [], embeds: [], content: 'You prestiged!' });
                }
                else if (i.customId === 'deny') {
                    prestigeMessage.edit({ components: [], embeds: [], content: 'You decided not to prestige.' });
                }
            })
            // What happens if the collector receives no button press that makes it past the filter
            .catch(() => {
                row.components.forEach(button => button.setDisabled(true));
                prestigeMessage.edit({ components: [row] });
            });
        }
        catch (error) {
            responseMethod(`There was an error! ${error.name}: ${error.message}`);
            console.log(error);
        }
    },
};
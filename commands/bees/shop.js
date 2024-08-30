// Required dependencies
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Sequelize } = require('sequelize');

// Initialise all functions and required tables from universal module
const {
    playerinformation,
    beelist,
    capitaliseWords,
    beeFact,
    increaseTypeSuffixMap,
    interactionAuthFunc,
} = require('C:/Bee Shop/universalmodule.js');

playerinformation.sync();
beelist.sync();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('shop')
		.setDescription('Check out the bee shop'),
	async execute(responseMethod, interaction) {
        try {
            // Identify if a command was initiated through slash or text.
            const interactionAuth = await interactionAuthFunc(interaction);
            const findplayer = await playerinformation.findOne({ where: { playerid: interactionAuth.id } });
            // Create shop embed
            let text = '';
            const shopBees = await beelist.findAll({ where: { findType: 'shop', prestigeReq: { [Sequelize.Op.lte]: findplayer.get('prestiges') }, levelReq: { [Sequelize.Op.lte]: findplayer.get('level') } } });
            for (const bee of shopBees) {
                const prefix = bee.get('increaseType').startsWith('add-') ? '+' : 'x';
                const suffix = increaseTypeSuffixMap[bee.get('increaseType')];
                text += `${capitaliseWords(bee.get('beeName'))} (${prefix}${bee.get('beeBaseIncrease')} ${suffix}):  ${bee.get('beePrice')} money\n`;
            }
            const shopembed = new EmbedBuilder()
            .setColor(0xffe521)
            .setTitle('The Bee Shop')
            .setFooter({ text: beeFact() })
            .addFields({ name: '\u200b', value: 'Hello, welcome to the bee shop! Here you can buy bees that can work for you.' })
            .addFields({ name: 'Bees', value: `\n\n${text}` });
            await responseMethod({ embeds: [shopembed] });
        }
        catch (error) {
            await responseMethod(`There was an error! ${error.name}: ${error.message}`);
            console.log(error);
        }
    },
};